import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
if(process.platform!=='win32') throw new Error('Native isolated test harness only');
const base=path.join(process.env.TEMP,'delunivo-capacity-tools');
const state=JSON.parse(fs.readFileSync(path.join(base,'state.json'),'utf8'));
if(!path.resolve(state.data).startsWith(path.resolve(base)+path.sep) || state.dbPort!==54399) throw new Error('Unverified native test state');
const exe=path.join(base,'postgres/pgsql/bin/psql.exe');
const args=['-h','127.0.0.1','-p','54399','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1'];
const actual=execFileSync(exe,[...args,'-tAc','show data_directory'],{encoding:'utf8',windowsHide:true}).trim();
if(path.resolve(actual)!==path.resolve(state.data)) throw new Error('Wrong native PostgreSQL data directory');
for(const file of ['20261001132712_platform_plans_and_usage.sql','20261001151159_provider_cost_reconciliation.sql','20261001162500_capacity_worker_coordination.sql']) {
  const text=fs.readFileSync(path.join('supabase/migrations',file),'utf8');
  const functions=[...text.matchAll(/create (?:or replace )?function[\s\S]+?\$\$;/g)].map(m=>m[0].replace(/^create function/,'create or replace function'));
  execFileSync(exe,args,{input:functions.join('\n'),stdio:['pipe','ignore','pipe'],windowsHide:true});
}
execFileSync(exe,[...args,'-c',"NOTIFY pgrst, 'reload schema';"],{stdio:'ignore',windowsHide:true});
console.log('Functions refreshed only in the verified portable PostgreSQL test directory.');
