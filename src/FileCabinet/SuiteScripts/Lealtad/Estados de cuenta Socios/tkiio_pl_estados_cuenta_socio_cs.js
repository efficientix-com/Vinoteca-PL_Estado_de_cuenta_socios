/**
 * @NApiVersion 2.x
 * @NScriptType ClientScript
 * @NModuleScope SameAccount
 */
define(['N/log','N/search','N/url','N/format','N/ui/message','N/currentRecord'],
/**
 * @param{log} log
 * @param{redirect} redirect
 */
function(log, search,url,format,message,currentRecord) {
    
    /**
     * Function to be executed after page is initialized.
     *
     * @param {Object} scriptContext
     * @param {Record} scriptContext.currentRecord - Current form record
     * @param {string} scriptContext.mode - The mode in which the record is being accessed (create, copy, or edit)
     *
     * @since 2015.2
     */
    function pageInit(scriptContext) {
        try {
            console.log("entre al client")
        } catch (error) {
            console.error("error Page Init: ",error);
        }

    }

    /**
     * Function to be executed when field is changed.
     *
     * @param {Object} scriptContext
     * @param {Record} scriptContext.currentRecord - Current form record
     * @param {string} scriptContext.sublistId - Sublist name
     * @param {string} scriptContext.fieldId - Field name
     * @param {number} scriptContext.lineNum - Line number. Will be undefined if not a sublist or matrix field
     * @param {number} scriptContext.columnNum - Line number. Will be undefined if not a matrix field
     *
     * @since 2015.2
     */
    function fieldChanged(scriptContext) {
        try {
            var objRecord = scriptContext.currentRecord;
            console.log("Entre al field");
            if(scriptContext.fieldId === "custpage_pl_partner_number"){
                console.log("Entre")
                let cardNumber = objRecord.getText({
                    fieldId:"custpage_pl_partner_number"
                });
                // console.log(cardNumber);
                let partnerInfo = getPartnerData(cardNumber);
                if(partnerInfo.hasOwnProperty("id")){
                    objRecord.setValue({
                        fieldId: "custpage_pl_partner_name",
                        value: partnerInfo.name
                    });
                }

            }
            if(scriptContext.fieldId === "custpage_pl_select_page"){
                console.log('Entre a la página')
                let page = objRecord.getValue({ fieldId: 'custpage_pl_select_page' });
                let cardNumer = objRecord.getValue({ fieldId: 'custpage_pl_partner_number' });
                let namePartner = objRecord.getValue({ fieldId: 'custpage_pl_partner_name' });
                let dateStart = format.format({
                    value:  new Date(objRecord.getValue({ fieldId: 'custpage_pl_edo_soc_date_start' })),
                    type: format.Type.DATE
                });
                let dateEnd = format.format({
                    value: new Date (objRecord.getValue({ fieldId: 'custpage_pl_edo_soc_date_end' })),
                    type: format.Type.DATE});

                var output = url.resolveScript({
                    scriptId: 'customscript_tkiio_pl_edo_account_partne', deploymentId: 'customdeploy_tkiio_pl_edo_account_sl',
                    params: {
                        'page': page,
                        'card':cardNumer,
                        'name': namePartner,
                        'start': dateStart,
                        'end': dateEnd,
                    }, returnExternalUrl: false,
                });
                window.open(output, '_self');
            }
        } catch (error) {
            console.error('error: ',error);
        }
    }

    /**
     * @summary Function that search the partner's name with your card number
     * @param {*} cardNumber 
     * @returns 
     */
    function getPartnerData(cardNumber){
        try {
            var objSearch = search.create({
				type: "customrecord_efx_lealtad_socios",
				filters: [
					[
						"custrecord_efx_lealtad_numtarjetasocio.name",
						search.Operator.IS,
						cardNumber,
					],
				],
				columns: [{ name: "name" }, { name: "internalid" }],
			});
            var data = {};
			objSearch.run().each(function (result) {
				data["name"] = result.getValue({ name: "name" });
				data["id"] = result.getValue({ name: "internalid" });
				return true;
			});
			return data;
        } catch (error) {
            console.error("error: ",error);
        }
    }

    function printData(){
        try {
            var objRecord = currentRecord.get();
            let cardNumer = objRecord.getValue({ fieldId: 'custpage_pl_partner_number' });
            console.log(cardNumer);
            let namePartner = objRecord.getValue({ fieldId: 'custpage_pl_partner_name' });
            let dateStart = format.format({
                value:  new Date(objRecord.getValue({ fieldId: 'custpage_pl_edo_soc_date_start' })),
                type: format.Type.DATE
            });
            let dateEnd = format.format({
                value: new Date (objRecord.getValue({ fieldId: 'custpage_pl_edo_soc_date_end' })),
                type: format.Type.DATE});
            
            if(cardNumer){
                var resolveUrl = url.resolveScript({
                    scriptId: 'customscript_tkiio_pl_edo_account_partne',
                    deploymentId: 'customdeploy_tkiio_pl_edo_account_sl',
                    returnExternalUrl: false,
                    params: {
                        'print': true,
                        'card':cardNumer,
                        'name': namePartner,
                        'start': dateStart,
                        'end': dateEnd,
                        
                    }
                });
                window.open(resolveUrl, '_blank');
            }else{
                var alertMessage = message.create({
                    type: message.Type.WARNING,
                    title: 'Error de impresión',
                    message: 'Asegurese de realizar primero el filtrado de los datos',
                    duration: 15000
                });
                alertMessage.show();
            }

        } catch (error) {
            console.error('Error printData: ',error)
        }
    }

    return {
        pageInit: pageInit,
        fieldChanged: fieldChanged,
        printData:printData
    };
    
});
