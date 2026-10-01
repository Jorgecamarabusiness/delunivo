import fs from 'node:fs';
import path from 'node:path';
import {execFileSync,spawn} from 'node:child_process';
import {randomBytes,createHmac} from 'node:crypto';
if(process.platform!=='win32') throw new Error('Native Windows test harness only; use isolated Supabase CI elsewhere.');
const base=path.join(process.env.TEMP,'delunivo-capacity-tools');
const bin=path.join(base,'postgres','pgsql','bin');
const data=path.join(base,`data-${Date.now()}`);
const execute=(exe,args)=>execFileSync(path.join(bin,exe),args,{stdio:['ignore','pipe','pipe'],windowsHide:true});
execute('initdb.exe',['-D',data,'-U','postgres','-A','trust','--encoding=UTF8','--locale=C']);
fs.appendFileSync(path.join(data,'postgresql.conf'),"\nlisten_addresses='127.0.0.1'\nport=54399\n");
execFileSync(path.join(bin,'pg_ctl.exe'),['-D',data,'-l',path.join(base,'postgres-test.log'),'-w','start'],{stdio:'ignore',windowsHide:true});
const sqlArgs=['-h','127.0.0.1','-p','54399','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1'];
try {
  execute('psql.exe',[...sqlArgs,'-f','scripts/portable-capacity-bootstrap.sql']);
  for(const file of fs.readdirSync('supabase/migrations').filter(f=>f.endsWith('.sql')).sort()) execute('psql.exe',[...sqlArgs,'-f',path.join('supabase/migrations',file)]);
} catch(error) {
  console.error(String(error.stderr ?? error.message));
  execute('pg_ctl.exe',['-D',data,'-w','stop']);
  process.exit(1);
}
const secret=randomBytes(32).toString('hex');
const head=Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url');
const payload=Buffer.from(JSON.stringify({role:'service_role',iss:'isolated-portable-test',exp:Math.floor(Date.now()/1000)+7200})).toString('base64url');
const token=`${head}.${payload}.${createHmac('sha256',secret).update(`${head}.${payload}`).digest('base64url')}`;
const config=path.join(base,'postgrest.conf');
fs.writeFileSync(config,`db-uri = "postgresql://authenticator@127.0.0.1:54399/postgres"\ndb-schemas = "public"\ndb-anon-role = "anon"\njwt-secret = "${secret}"\nserver-host = "127.0.0.1"\nserver-port = 54397\n`);
const rest=spawn(path.join(base,'postgrest','postgrest.exe'),[config],{windowsHide:true,stdio:'ignore',env:{...process.env,Path:`${bin};${process.env.Path ?? process.env.PATH}`}});
fs.writeFileSync('.env.capacity-isolated.local',`NEXT_PUBLIC_SUPABASE_URL="http://127.0.0.1:54398"\nSUPABASE_SERVICE_ROLE_KEY="${token}"\n`);
fs.writeFileSync(path.join(base,'state.json'),JSON.stringify({data,restPid:rest.pid,dbPort:54399,apiPort:54398}));
rest.unref();
const proxy=spawn(process.execPath,['scripts/portable-rest-proxy.mjs'],{windowsHide:true,stdio:'ignore'});proxy.unref();
console.log('PostgreSQL migrations applied; authenticated loopback PostgREST on 54398. Auth/Storage compatibility schemas, not full services.');
