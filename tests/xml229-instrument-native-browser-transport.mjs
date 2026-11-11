/** Explicit browser-test transport to the actual production Python native CLI.
 * No output, mass proof, acceptance packet or release flag is mocked.
 */
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';

export async function handleXml229InstrumentNativeRequest(req,res){
 const chunks=[];
 for await(const chunk of req)chunks.push(chunk);
 const job=JSON.parse(Buffer.concat(chunks).toString('utf8'));
 const dir=await mkdtemp(join(tmpdir(),'instrument-native-browser-'));
 try{
  const input=join(dir,'source.xml'),staged=join(dir,'source.json'),packet=join(dir,'packet.json');
  const output=join(dir,'actual.cii'),proof=join(dir,'proof.json');
  await writeFile(input,job.sourceText);await writeFile(staged,job.stagedJsonText);
  await writeFile(packet,JSON.stringify(job.xml229NativeFinalPacket));
  const args=['converters/scripts/xml_to_cii2019_runtime_custody.py',
   '--input',input,'--output',output,'--weight-scale','10',
   '--staged-json',staged,'--support-config-json',job.supportConfigJson,
   '--xml229-native-final-packet',packet,'--xml229-native-mass-proof',proof];
  if(job.options?.useRestraintTypeBasedOnJson===false)args.push('--no-use-restraint-type-based-on-json');
  execFileSync('python3',args,{encoding:'utf8',timeout:120000});
  const result={ok:true,ciiText:await readFile(output,'utf8'),
   xml229NativeMassDiagnostic:JSON.parse(await readFile(proof,'utf8'))};
  res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify(result));
 }catch(error){
  res.writeHead(500,{'content-type':'application/json'});
  res.end(JSON.stringify({ok:false,error:String(error?.stderr||error)}));
 }finally{await rm(dir,{recursive:true,force:true});}
}
