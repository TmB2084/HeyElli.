// Independent public releases: edit only the entry for the changed app.
export type AppRelease={year:number;publication:number;publishedOn:string;creator:string};
export const appReleases:Record<string,AppRelease>={
 '/':{year:26,publication:55,publishedOn:'2026-11-22',creator:'Tim Braun'},
 '/hilfe':{year:26,publication:56,publishedOn:'2026-11-20',creator:'Tim Braun'},
 '/servicehub':{year:26,publication:79,publishedOn:'2026-11-23',creator:'Tim Braun'},
 '/casedesk':{year:26,publication:20,publishedOn:'2026-11-22',creator:'Tim Braun'},
 '/planboard':{year:26,publication:17,publishedOn:'2026-11-21',creator:'Tim Braun'},
 '/maildesk':{year:26,publication:8,publishedOn:'2026-11-21',creator:'Tim Braun'},
 '/taskhub':{year:26,publication:1,publishedOn:'2026-11-21',creator:'Tim Braun'},
 '/missioncontrol':{year:26,publication:1,publishedOn:'2026-11-21',creator:'Tim Braun'},
 '/dutyboard':{year:26,publication:4,publishedOn:'2026-11-21',creator:'Tim Braun'},
 '/benutzerkonto':{year:26,publication:8,publishedOn:'2026-11-21',creator:'Tim Braun'},
 '/einstellungen':{year:26,publication:42,publishedOn:'2026-11-22',creator:'Tim Braun'},
};
export const defaultAppRelease:AppRelease={year:26,publication:1,publishedOn:'2026-11-11',creator:'Tim Braun'};

// Platform release tracks technical infrastructure and shared menu bar independently.
export const platformRelease:AppRelease={year:26,publication:53,publishedOn:'2026-11-22',creator:'Tim Braun'};
