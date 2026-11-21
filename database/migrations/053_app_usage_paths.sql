-- App-Nutzung: MailDesk (seit Migration 049) und Aufgaben fehlten in der Prüfbedingung; die Zählung schlug für sie fehl.
ALTER TABLE platform.app_usage DROP CONSTRAINT app_usage_app_path_check;
ALTER TABLE platform.app_usage ADD CONSTRAINT app_usage_app_path_check CHECK(app_path IN ('/','/hilfe','/service','/stoerungsmeister','/ressourcenmeister','/bereitschaftsmeister','/maildesk','/aufgaben','/benutzerkonto','/einstellungen'));
