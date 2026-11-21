CREATE TABLE platform.app_roles (
 id text PRIMARY KEY,
 name text NOT NULL CHECK(length(name) BETWEEN 1 AND 80),
 base_role text NOT NULL CHECK(base_role IN ('reader','dispatcher')),
 apps jsonb NOT NULL CHECK(jsonb_typeof(apps)='array'),
 version integer NOT NULL DEFAULT 1,
 builtin boolean NOT NULL DEFAULT false
);
INSERT INTO platform.app_roles(id,name,base_role,apps,builtin) VALUES
 ('reader','Lesezugriff','reader','["/","/hilfe","/service","/stoerungsmeister","/ressourcenmeister","/bereitschaftsmeister","/benutzerkonto"]',true),
 ('dispatcher','Disposition','dispatcher','["/","/hilfe","/service","/stoerungsmeister","/ressourcenmeister","/bereitschaftsmeister","/benutzerkonto"]',true);
ALTER TABLE platform.users ADD COLUMN app_role_id text REFERENCES platform.app_roles(id);
