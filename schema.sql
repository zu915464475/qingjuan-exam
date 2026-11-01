CREATE SCHEMA qingjuan;
REVOKE ALL ON SCHEMA qingjuan FROM PUBLIC, anon, authenticated;
SET search_path TO qingjuan,pg_catalog;
CREATE TABLE attempts (
	id text PRIMARY KEY NOT NULL,
	user_id text NOT NULL,
	exam_id text NOT NULL,
	snapshot text NOT NULL,
	answers text NOT NULL,
	started bigint NOT NULL,
	deadline bigint NOT NULL,
	submitted bigint,
	score bigint
);

CREATE TABLE exams (
	id text PRIMARY KEY NOT NULL,
	body text NOT NULL,
	active bigint NOT NULL,
	created bigint NOT NULL
);

CREATE TABLE auth_limits (
	id text PRIMARY KEY NOT NULL,
	count bigint NOT NULL,
	until bigint NOT NULL
);

CREATE TABLE questions (
	id text PRIMARY KEY NOT NULL,
	body text NOT NULL,
	created bigint NOT NULL
);

CREATE TABLE sessions (
	id text PRIMARY KEY NOT NULL,
	user_id text NOT NULL,
	expires bigint NOT NULL
);

CREATE TABLE users (
	id text PRIMARY KEY NOT NULL,
	name text NOT NULL,
	password text NOT NULL,
	role text NOT NULL
);

CREATE UNIQUE INDEX users_name_unique ON users (name);
ALTER TABLE users ADD CONSTRAINT user_role CHECK(role IN ('teacher','student'));
CREATE INDEX attempts_user_started ON attempts(user_id,started DESC);
CREATE INDEX attempts_exam_user ON attempts(exam_id,user_id);
CREATE INDEX sessions_user ON sessions(user_id);
CREATE INDEX sessions_expiry ON sessions(expires);
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON users FROM PUBLIC,anon,authenticated;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON questions FROM PUBLIC,anon,authenticated;
ALTER TABLE exams ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON exams FROM PUBLIC,anon,authenticated;
ALTER TABLE attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON attempts FROM PUBLIC,anon,authenticated;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON sessions FROM PUBLIC,anon,authenticated;
ALTER TABLE auth_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON auth_limits FROM PUBLIC,anon,authenticated;
RESET search_path;
