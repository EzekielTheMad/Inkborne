-- Cover the composite foreign keys introduced by importer conflict resolution.
-- These indexes keep target-version validation and cascades efficient as import
-- provenance grows.

CREATE INDEX content_import_items_replacement_version_idx
  ON public.content_import_items(replacement_content_id, replacement_expected_version);

CREATE INDEX content_import_origins_replaced_from_version_idx
  ON public.content_import_origins(content_id, replaced_from_version);
