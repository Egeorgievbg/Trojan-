INSERT INTO households(id,title) VALUES
('family-evgeni','Евгени, Илияна и Ивелин'),
('family-vesko','Веско, Мария и децата'),
('family-desi','Деси, Иванчо и детето'),
('family-nakata','Наката, Викито, Магито и детето')
ON CONFLICT(id) DO NOTHING;
INSERT INTO members(id,household_id,name,child,ordinal) VALUES
('evgeni','family-evgeni','Евгени',false,1),('iliyana','family-evgeni','Илияна',false,2),('ivelin','family-evgeni','Ивелин',true,3),
('vesko','family-vesko','Веско',false,1),('maria','family-vesko','Мария',false,2),('momchil','family-vesko','Момчил',true,3),('velina','family-vesko','Велина',true,4),
('desi','family-desi','Деси',false,1),('ivancho','family-desi','Иванчо',false,2),('desi-child','family-desi','Дете на Деси и Иванчо',true,3),
('nakata','family-nakata','Наката',false,1),('vikito','family-nakata','Викито',false,2),('magito','family-nakata','Магито',false,3),('magi-child','family-nakata','Синът на Магито',true,4)
ON CONFLICT(id) DO NOTHING;
INSERT INTO event_settings(id,value) VALUES(1,'{"dates":["2026-12-31","2027-01-01","2027-01-02"],"nights":2,"address":"","navigation":"","arrival":"","departure":"","bring":""}'::jsonb) ON CONFLICT(id) DO NOTHING;