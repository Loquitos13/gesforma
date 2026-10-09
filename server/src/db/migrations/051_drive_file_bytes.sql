CREATE TABLE IF NOT EXISTS drive_file_bytes (
  id text PRIMARY KEY REFERENCES drive_files (id) ON DELETE CASCADE,
  bytes bytea NOT NULL
);
