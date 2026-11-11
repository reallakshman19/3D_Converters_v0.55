#!/usr/bin/env node
/**
 * XML229 R2-D — independent, OFFLINE external diagnostic export.
 * Usage: node scripts/xml229-r2-external-log-cli.mjs --input receipts.json --out logs/xml229-r2
 *
 * Input is a JSON envelope containing metadata/physical rows/receipts only.
 * Do not supply original XML, staged JSON, File/Blob bytes or secret fields.
 * No network, browser DOM, native Python converter, or engineering writer.
 * Output: logs/xml229-r2.json and logs/xml229-r2.csv (release always HOLD).
 */
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildXml229ExternalDiagnosticLog}
 from '../tabs/xml-cii-2019-standalone/integration/xml229-r2-external-diagnostic-log.mjs';

export async function publishXml229ReadOnlyLog({inputPath,outStem}={}){
 if(!inputPath||!outStem||typeof inputPath!=='string'||typeof outStem!=='string')
   throw new Error('Usage: --input <receipt-json> --out <output-path-stem>');
 const input=JSON.parse(await readFile(inputPath,'utf8'));
 const {log,json,csv}=await buildXml229ExternalDiagnosticLog(input);
 await mkdir(dirname(resolve(outStem)),{recursive:true});
 await writeFile(outStem+'.json',json,'utf8');
 await writeFile(outStem+'.csv',csv,'utf8');
 return {jsonPath:outStem+'.json',csvPath:outStem+'.csv',
   rows:log.expectedOriginalPhysicalCount,held:log.heldCount,status:log.releaseStatus};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const args=process.argv.slice(2);
 const inputPath=args[args.indexOf('--input')+1];
 const outStem=args[args.indexOf('--out')+1];
 if(!args.includes('--input')||!args.includes('--out')){
   process.stderr.write('Usage: node scripts/xml229-r2-external-log-cli.mjs --input <receipt.json> --out <stem>\n');
   process.exitCode=2;
 }else{
   try{
     const result=await publishXml229ReadOnlyLog({inputPath,outStem});
     process.stdout.write(JSON.stringify(result)+'\n');
   }catch(error){
     process.stderr.write('XML229 external log refused: '+String(error?.code||'ERROR')+': '+error.message+'\n');
     process.exitCode=1;
   }
 }
}
