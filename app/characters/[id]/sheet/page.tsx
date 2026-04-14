import { redirect } from "next/navigation";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function CharacterSheetRedirect({ params }: PageProps) {
  const { id } = await params;
  redirect(`/characters/${id}`);
}
