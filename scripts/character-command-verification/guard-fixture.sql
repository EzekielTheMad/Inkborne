CREATE TABLE private.character_writer_guard_v1(singleton boolean PRIMARY KEY CHECK (singleton), marker integer NOT NULL DEFAULT 1);
INSERT INTO private.character_writer_guard_v1(singleton) VALUES (true);
