CREATE TABLE platform.app_usage (
 user_id text NOT NULL REFERENCES platform.users(id) ON DELETE CASCADE,
 app_path text NOT NULL CHECK(app_path IN ('/','/hilfe','/service','/stoerungsmeister','/ressourcenmeister','/bereitschaftsmeister','/benutzerkonto','/einstellungen')),
 visits bigint NOT NULL DEFAULT 1 CHECK(visits>0),
 PRIMARY KEY(user_id,app_path)
);
