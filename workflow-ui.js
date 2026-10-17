let priceApprovalSaving=false;
function updateWorkflow(){
 const details=$('confirmed').checked,price=$('priceApproved').checked&&priceValid();
 $('priceApprovalStatus').textContent=priceApprovalSaving?'Saving price approval…':price?'Selling price approved.':'Selling price needs approval.';
 $('approvePrice').disabled=priceApprovalSaving||!priceValid();
 $('workflowStatus').textContent=!details?'Review and approve product details.':!price?'Enter a positive selling price and approve it.':'Ready to create marketing or export your catalogue.';
 $('reportContinue').disabled=priceApprovalSaving||!details||!price;
}
$('approvePrice').onclick=async()=>{
 if(priceApprovalSaving)return;
 if(!priceValid()){toast('Enter a valid positive selling price.');return}
 clearTimeout(draftSaveTimer);priceApprovalSaving=true;const amount=$('price').value;
 $('priceApproved').checked=true;$('priceApproved').onchange();$('approvePrice').disabled=true;
 const saved=await saveDraft();if(!saved){$('priceApproved').checked=false;toast('Price approval could not be saved. Your amount is retained; retry approval.')}else if($('price').value===amount&&$('priceApproved').checked)toast('Selling price approved and saved.');priceApprovalSaving=false;updateWorkflow();
};
document.addEventListener('input',updateWorkflow);document.addEventListener('change',updateWorkflow);document.addEventListener('click',updateWorkflow);updateWorkflow();
