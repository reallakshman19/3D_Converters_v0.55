import { renderXmlCiiCustomInputPanel, bindXmlCiiCustomInputPanel } from './custom-input-panel.js?v=20260625-custom-input-2';
const FLAG='xmlCiiCustomInputWorkflowTabBound';
function mount(root=document){
  const overlay=[...document.querySelectorAll('[data-xml-cii-workflow-overlay],.model-converters-workflow-popup-overlay')].at(-1);
  const body=overlay?.querySelector('[data-xml-cii-workflow-body]');
  const modalRoot=overlay?.querySelector('[data-xml-cii-workflow-root]')||root;
  if(!body) return false;
  body.innerHTML=renderXmlCiiCustomInputPanel();
  bindXmlCiiCustomInputPanel(body,modalRoot,{phaseId:'custom-input',modal:null});
  return true;
}
function schedule(root){requestAnimationFrame(()=>{if(root.isConnected)mount(root)||setTimeout(()=>{if(root.isConnected)mount(root);},40);});}
export function installXmlCiiCustomInputWorkflowTab(container=document){
  const root=container?.querySelector?.('.model-converters-root')||container||document;
  if(!root||root.dataset?.[FLAG]==='true')return; root.dataset[FLAG]='true';
  const onClick=(event)=>{const tab=event.target?.closest?.('[data-modal-tab="custom-input"]'); if(!tab)return; schedule(root);};
  root.addEventListener('click',onClick,true);
  document.addEventListener('click',onClick,true);
  if(document.querySelector('[data-modal-tab="custom-input"].is-active,[data-modal-tab="custom-input"][aria-selected="true"]')) schedule(root);
  return ()=>{root.removeEventListener('click',onClick,true);document.removeEventListener('click',onClick,true);delete root.dataset[FLAG];};
}
