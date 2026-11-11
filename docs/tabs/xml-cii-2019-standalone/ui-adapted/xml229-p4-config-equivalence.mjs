/** Semantic configuration equality for the existing source/master lease. */
import {canonicalJson} from '../../../contracts/gc-pw-v1/contract.mjs';
export function xml229P4ConfigEquivalent(a,b){
 if(a===b)return true;
 try{return canonicalJson(JSON.parse(a||'{}'))===canonicalJson(JSON.parse(b||'{}'));}
 catch{return false;}
}
