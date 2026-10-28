#!/bin/bash
# Unique, disposable project only. Never changes Unraid settings or existing apps.
set -Eeuo pipefail
umask 077
run_id=${1:?run UUID required}; expected_engine=${2:?engine required}
[[ $run_id =~ ^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$ ]]
run_dir=/mnt/cache/appdata/inkborne-test-runner/runs/$run_id
[[ $(pwd -P) == "$run_dir" && ! -L "$run_dir" ]]
[[ $(docker info --format '{{.ID}}') == "$expected_engine" ]]
project=inkborne-test-${run_id:0:8}
[[ $(jq -r .project host.json) == "$project" && $(jq -r .runDirectory host.json) == "$run_dir" ]]
for name in private output; do [[ ! -e $name ]]; mkdir "$name"; done
cp host.json source.json private/
tar -xf catalog.tar -C source --one-top-level=.test-catalog
image=$(jq -r .image host.json); head=$(jq -r .sourceHead host.json)
[[ $head =~ ^[a-f0-9]{40}$ && $image == inkborne-test-runner:${head:0:12} ]]
mem_available(){ awk '/MemAvailable:/{print $2}' /proc/meminfo; }
(( $(mem_available) >= 16777216 )) || { echo 'Unraid needs 16 GiB available before this test'; exit 1; }
(( $(df -Pk "$run_dir" | awk 'NR==2{print $4}') >= 15728640 )) || { echo 'Unraid SSD needs 15 GiB free'; exit 1; }
(( $(df -Pk /var/lib/docker | awk 'NR==2{print $4}') >= 15728640 )) || { echo 'Unraid Docker image disk needs 15 GiB free'; exit 1; }
[[ -z $(docker ps -aq --filter label=org.inkborne.test.run) ]] || { echo 'Another Inkborne test project exists; inspect before starting'; exit 1; }
docker ps -a --format '{{json .}}' | jq -s 'map({id:.ID,name:.Names,state:.State})|sort_by(.id)' > output/services-before.json
printf '{"availableKiB":%s,"load":"%s","startedUtc":"%s"}\n' "$(mem_available)" "$(cat /proc/loadavg)" "$(date -u +%FT%TZ)" > output/host-before.json
compose=(docker compose --project-name "$project" --project-directory "$run_dir" --env-file "$run_dir/private/runtime.env" -f "$run_dir/source/scripts/unraid/compose.yaml")
created=false; phase=image-build; result=failed
cleanup(){
 local code=$?; trap - EXIT INT TERM HUP; set +e
 local clean=true
 if [[ $created == true ]]; then
  # Fail closed if another identity is found under this exact Compose project.
  local id
  for id in $(docker ps -aq --filter "label=com.docker.compose.project=$project"); do
   [[ $(docker inspect -f '{{index .Config.Labels "org.inkborne.test.run"}}' "$id") == "$run_id" ]] || clean=false
  done
  for id in $(docker network ls -q --filter "label=com.docker.compose.project=$project"); do
   [[ $(docker network inspect -f '{{index .Labels "org.inkborne.test.run"}}' "$id") == "$run_id" ]] || clean=false
  done
  for id in $(docker volume ls -q --filter "label=com.docker.compose.project=$project"); do
   [[ $(docker volume inspect -f '{{index .Labels "org.inkborne.test.run"}}' "$id") == "$run_id" ]] || clean=false
  done
  if [[ $clean == true ]]; then "${compose[@]}" down --volumes --timeout 15 >> private/lifecycle.log 2>&1 || clean=false; fi
 fi
 [[ -z $(docker ps -aq --filter "label=org.inkborne.test.run=$run_id") ]] || clean=false
 [[ -z $(docker network ls -q --filter "label=org.inkborne.test.run=$run_id") ]] || clean=false
 [[ -z $(docker volume ls -q --filter "label=org.inkborne.test.run=$run_id") ]] || clean=false
 docker ps -a --format '{{json .}}' | jq -s 'map({id:.ID,name:.Names,state:.State})|sort_by(.id)' > output/services-after.json
 local unchanged=false; cmp -s output/services-before.json output/services-after.json && unchanged=true
 # Export only redacted, bounded diagnostics; delete credentials and raw logs.
 if [[ $result != passed && $phase == image-build ]]; then
  # No credentials exist yet; this contains only public package/image build output.
  tail -c 24000 private/build.log | tail -n 100 > output/diagnostic.txt
 elif [[ $result != passed ]] && docker image inspect "$image" >/dev/null 2>&1; then
  docker run --rm --network none --cap-drop ALL --security-opt no-new-privileges:true --memory 128m --cpus 0.5 -v "$run_dir/private:/run/inkborne:ro" -v "$run_dir/output:/output" "$image" node scripts/unraid/diagnostics.mjs >/dev/null 2>&1
 fi
 if [[ $clean == true && $(realpath private) == "$run_dir/private" && ! -L private ]]; then
  rm -rf -- "$run_dir/private"
 fi
 local credentials_removed=false; [[ ! -e private ]] && credentials_removed=true
 printf '{"result":"%s","phase":"%s","ephemeralResourcesRemoved":%s,"credentialsRemoved":%s,"existingServicesUnchanged":%s,"availableKiB":%s,"finishedUtc":"%s"}\n' "$result" "$phase" "$clean" "$credentials_removed" "$unchanged" "$(mem_available)" "$(date -u +%FT%TZ)" > output/host-result.json
 echo "Unraid test: $result; temporary resources removed: $clean; existing services unchanged: $unchanged"
 [[ $clean == true && $credentials_removed == true && $unchanged == true && $code == 0 ]] || code=1
 exit "$code"
}
trap cleanup EXIT; trap 'exit 130' INT TERM HUP
echo 'Preparing reusable test image (first run downloads browsers and dependencies)'
timeout 1200 env DOCKER_BUILDKIT=0 docker build --force-rm --memory 4g --memory-swap 4g --cpu-period 100000 --cpu-quota 300000 --label "org.inkborne.test.source=$head" -t "$image" -f source/scripts/unraid/Dockerfile source > private/build.log 2>&1
phase=scratch-credentials
docker run --rm --network none --cap-drop ALL --security-opt no-new-privileges:true --memory 128m --cpus 0.5 -v "$run_dir/private:/run/inkborne" "$image" node scripts/unraid/config.mjs >> private/lifecycle.log 2>&1
phase=backend-create; created=true
"${compose[@]}" create >> private/lifecycle.log 2>&1
ids=$(docker ps -aq --filter "label=com.docker.compose.project=$project")
[[ $(wc -w <<< "$ids") == 6 ]]
docker inspect $ids | jq '[.[]|{id:.Id,imageId:.Image,name:.Name,run:.Config.Labels["org.inkborne.test.run"],memory:.HostConfig.Memory,nanoCpus:.HostConfig.NanoCpus,pidLimit:.HostConfig.PidsLimit,networkMode:.HostConfig.NetworkMode,privileged:.HostConfig.Privileged,ports:.HostConfig.PortBindings,mounts:[.Mounts[]|{type:.Type,source:.Source,target:.Destination}]}]' > output/resources.json
jq -e --arg run "$run_id" 'length==6 and all(.[];.run==$run and .memory>0 and .nanoCpus>0 and .privileged==false and (.ports==null or .ports=={}) and .networkMode!="host" and all(.mounts[];.target!="/var/run/docker.sock"))' output/resources.json > /dev/null
"${compose[@]}" start db >> private/lifecycle.log 2>&1
db=$("${compose[@]}" ps -q db)
phase=database-ready
for ((i=0;i<120;i++)); do docker exec "$db" pg_isready -h /var/run/postgresql -U postgres -d postgres >/dev/null 2>&1 && break; sleep 1; done
docker exec "$db" pg_isready -h /var/run/postgresql -U postgres -d postgres >/dev/null
for service in auth-migrate storage-migrate; do
 phase=$service; "${compose[@]}" start "$service" >> private/lifecycle.log 2>&1
 job=$("${compose[@]}" ps -aq "$service")
 [[ $(timeout 120 docker wait "$job") == 0 ]]
done
pg_id=$(docker exec "$db" psql -h /var/run/postgresql -U supabase_admin -d postgres -XqAtc 'SELECT system_identifier::text FROM pg_control_system()')
jq -n --arg run "$run_id" --arg head "$head" --arg engine "$expected_engine" --arg db "$db" --arg pg "$pg_id" '{kind:"inkborne-unraid-test-runtime-v1",runId:$run,sourceHead:$head,engineId:$engine,databaseId:$db,pgSystemId:$pg}' > private/runtime.json
"${compose[@]}" start auth rest >> private/lifecycle.log 2>&1
phase=verification
"${compose[@]}" start runner >> private/lifecycle.log 2>&1
runner=$("${compose[@]}" ps -q runner)
echo 'Running focused source checks and the actual character workflow on Unraid'
deadline=$((SECONDS+1200)); minimum=$(mem_available)
while [[ $(docker inspect -f '{{.State.Running}}' "$runner") == true ]]; do
 available=$(mem_available); (( available < minimum )) && minimum=$available
 if (( available < 4194304 || SECONDS >= deadline )); then
  phase=resource-or-time-limit; docker stop --time 15 "$runner" >/dev/null; exit 1
 fi
 sleep 3
done
printf '{"minimumAvailableKiB":%s}\n' "$minimum" > output/host-during.json
[[ $(docker inspect -f '{{.State.ExitCode}}' "$runner") == 0 ]]
result=passed; phase=complete
