/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
* @name tkiio_pl_estados_cuenta_socio_cs
* @version 1.0
* @author Adrián Aguilar <adrian.aguilar@freebug.mx>
* @summary Script that display the interface, filter the data and print the PDF
* @copyright Tekiio México 2022
* 
* Client              -> Vinoteca
* Last modification   -> 18/07/2023
* Modified by         -> Dylan Mendoza <dylan.mendoza@freebug.mx>
* Script in NS        -> Registro en Netsuite <customscript_tkiio_pl_edo_account_partne>
*/
define(['N/log', 'N/ui/serverWidget', 'N/config', 'N/search', 'N/format', 'N/url', 'N/record', 'N/render', 'N/runtime', './moment'],
    /**
 * @param{log} log
 * @param{record} record
 * @param{search} search
 */
    (log, serverWidget, config, search, format, url, record, render, runtime, moment) => {

        /**Global Variables*/
        const CUSTOM_BUTTONS = {};
        CUSTOM_BUTTONS.FILTER = 'submitButton_pl_edo_cuenta_filter';
        CUSTOM_BUTTONS.PRINT = 'button_pl_edo_soc_print';

        const CUSTOM_CONTAINER = {};
        CUSTOM_CONTAINER.FILTERS = 'fieldgroup__pl_filters'

        const CUSTOM_SOURCE = {};
        CUSTOM_SOURCE.NUM_CREDIT = 'customrecord_efx_lealtad_tarjetalealtad'

        const CUSTOM_FIELDS = {};
        CUSTOM_FIELDS.CREDIT_NUM = 'custpage_pl_partner_number';
        CUSTOM_FIELDS.NAME_PARTNER = 'custpage_pl_partner_name';
        CUSTOM_FIELDS.START_DATE = 'custpage_pl_edo_soc_date_start';
        CUSTOM_FIELDS.END_DATE = 'custpage_pl_edo_soc_date_end';
        CUSTOM_FIELDS.PAGE = 'custpage_pl_select_page';
        CUSTOM_FIELDS.FILTERS = 'custpage_pl_filters'

        const CUSTOM_SUBLIST = {}
        CUSTOM_SUBLIST.DATE = 'fieldid_pl_fecha';
        CUSTOM_SUBLIST.TYPE = 'fieldid_pl_type_transaction';
        CUSTOM_SUBLIST.TRANSACTION = 'fieldid_pl_transaction';
        CUSTOM_SUBLIST.LOCATION = 'fieldid_pl_sucursal';
        CUSTOM_SUBLIST.BONUS_POINTS = 'fieldid_pl_ptos_bonificados';
        CUSTOM_SUBLIST.POINTS_USED = 'fieldid_pl_ptos_utilizados';
        CUSTOM_SUBLIST.AMMOUNT_TRANSACTION = 'fieldid_pl_total_ticket';
        CUSTOM_SUBLIST.ORIGEN = 'fieldid_pl_origen';

        /**
         * Defines the Suitelet script trigger point.
         * @param {Object} scriptContext
         * @param {ServerRequest} scriptContext.request - Incoming request
         * @param {ServerResponse} scriptContext.response - Suitelet response
         * @since 2015.2
         */
        const onRequest = (scriptContext) => {
            try {
                var params = scriptContext.request.parameters;
                var idRecord = runtime.getCurrentScript().getParameter({ name: 'custscript_tkiio_pdf_template' });

                if (!params.print) {
                    var form = createInterface(scriptContext.request.parameters);//Create the interface
                    scriptContext.response.writePage({ pageObject: form });
                }

                var templateSearch = search.lookupFields({//Search the setup template
                    type: 'customrecord_efx_lealtad_config',
                    id: idRecord,
                    columns: ['custrecord_tkiio_template_stat_account', 'custrecord_tkiio_logo_edo_cuenta', 'custrecord_tkiio_tel_vinoteca_edo_cuenta']
                });

                const logo = (templateSearch.custrecord_tkiio_logo_edo_cuenta).replace(/&/g, '&amp;');
                const templateId = templateSearch.custrecord_tkiio_template_stat_account[0].value;
                const phone = templateSearch.custrecord_tkiio_tel_vinoteca_edo_cuenta;
                var objSearch;

                if (params.custpage_pl_partner_number && !(params.print)) {//In the case that  the execute button is clicked
                    let pagina = form.getField({ id: CUSTOM_FIELDS.PAGE });
                    let page = params.custpage_pl_select_page || 0;
                    objSearch = searchData(params);
                    let bloque = bloques(objSearch);
                    addSublist(bloque, form, page, pagina);

                } else if (params.card && !(params.print)) {//In the case that select a new page

                    let parametros = {//Generate a new object with the parameters, then send to the searchData function
                        card: params.card,
                        start: params.start,
                        end: params.end
                    }

                    updateFields(params, form);
                    let pagina = form.getField({ id: CUSTOM_FIELDS.PAGE });
                    let page = params.page || 0;
                    objSearch = searchData(parametros);
                    let bloque = bloques(objSearch);
                    addSublist(bloque, form, page, pagina);

                } else if (params.print) {

                    let parametros = {//Generate a new object with the parameters, then send to the searchData function
                        card: params.card,
                        start: params.start,
                        end: params.end
                    }
                    var fechaActual = new Date();

                    // Formatear la fecha en el formato DD/MM/YYYY
                    var fechaFormateada = moment.utc(fechaActual).format('DD/MM/YYYY');
                    var fieldLookUp = search.lookupFields({
                        type: 'customrecord_efx_lealtad_tarjetalealtad',
                        id: params.card,
                        columns: ['name']
                    });
                    let member = fieldLookUp.name;
                    let dataPartner = searchDataPartner(parametros.card);
                    objSearch = searchData(parametros);

                    let dataFinal = {
                        phone: phone,
                        logo: logo,
                        dateCreation: fechaFormateada,
                        namePartner: dataPartner.namePartner,
                        lealtadLevel: dataPartner.lealtadLevel,
                        membership: member,
                        pointsMember: dataPartner.pointsMember,
                        transactions: objSearch
                    }
                    const objFile = renderPdfWithTemplate(dataFinal, templateId);
                    scriptContext.response.writeFile({
                        file: objFile,
                        isInline: true
                    });
                }

            } catch (error) {
                log.error({ title: 'onRequest', details: error });
            }
        }


        /**
         * This function renders a PDF using a specified template and search object.
         * @param objSearch - It is an object that contains the data to be used in the PDF template.
         * The data is passed to the template to dynamically generate the PDF content.
         * @param templateId - The ID of the template that will be used to render the PDF.
         * @returns an object of type PDF, which is the result of rendering a NetSuite template with
         * the given ID and data provided in the objSearch parameter.
         */
        const renderPdfWithTemplate = (objSearch, templateId) =>{
            try {
                log.debug({ title: 'objSearch render', details: objSearch });
                const renderer = render.create()
                renderer.setTemplateById(templateId)
                renderer.addCustomDataSource({
                    format: render.DataSource.OBJECT,
                    alias: "records",
                    data: objSearch
                });
                const invoicePdf = renderer.renderAsPdf();
                return invoicePdf;
            } catch (error) {
                log.error({ title: 'error render', details: error });
            }
        }


        /**
         * The function searches for a partner's information based on their card number in a custom
         * record and returns their name, loyalty level, membership number, and total points.
         * @param card - The card parameter is a string representing the number of a loyalty program
         * card that is being searched for in the custom record "customrecord_efx_lealtad_socios". The
         * function searches for a record in this custom record that has a matching value in the
         * "custrecord_efx_lealtad
         * @returns an object with information about a loyalty program partner, including their name,
         * current loyalty level, membership number, and total points in the program. If there is an
         * error, an empty object is returned.
         */
        const searchDataPartner = (card) =>{
            try {
                var customrecord_efx_lealtad_sociosSearchObj = search.create({
                    type: "customrecord_efx_lealtad_socios",
                    filters:
                        [
                            ["custrecord_efx_lealtad_numtarjetasocio", search.Operator.ANYOF, card]
                        ],
                    columns:
                        [
                            search.createColumn({ name: "name", label: "Nombre" }),
                            search.createColumn({ name: "custentity_efx_lealtad_nivellealtadactua", join: "CUSTRECORD_EFX_LEALTAD_CLIENTERELSOCIO", label: "Nivel de Lealtad Actual" }),
                            search.createColumn({ name: "custentity_efx_lealtad_saldototalpuntos", join: "CUSTRECORD_EFX_LEALTAD_CLIENTERELSOCIO", label: "Saldo Total Puntos de Programa de Lealtad" }),
                            search.createColumn({ name: "custrecord_efx_lealtad_socionumerodesoci", label: "Número de socio de programa de lealtad" })
                        ]
                });
                var searchResultCount = customrecord_efx_lealtad_sociosSearchObj.runPaged().count;
                log.debug("customrecord_efx_lealtad_sociosSearchObj result count", searchResultCount);

                let objPartner = {}
                customrecord_efx_lealtad_sociosSearchObj.run().each(function (result) {
                    objPartner = {
                        namePartner: result.getValue({ name: "name"}),
                        lealtadLevel: result.getText({ name: "custentity_efx_lealtad_nivellealtadactua", join: "CUSTRECORD_EFX_LEALTAD_CLIENTERELSOCIO" }),
                        membership: result.getValue({ name: "custrecord_efx_lealtad_socionumerodesoci" }),
                        pointsMember: result.getValue({ name: "custentity_efx_lealtad_saldototalpuntos", join: "CUSTRECORD_EFX_LEALTAD_CLIENTERELSOCIO" }),
                    }
                    return true;
                });
                return objPartner;
            } catch (error) {
                log.error({ title: 'error searchDataPartner: ', details: error });
                return {}
            }
        }

        /** */
        /**
         * The function updates the default values of specific fields in a form with the values passed
         * in as parameters.
         * @param params - An object containing the values to be updated for the form fields. It has
         * the following properties:
         * @param form - The form object that contains the fields to be updated.
         */
        const updateFields = (params, form) =>{
            try {
                let card = form.getField({ id: CUSTOM_FIELDS.CREDIT_NUM });
                let dateStart = form.getField({ id: CUSTOM_FIELDS.START_DATE });
                let dateFinal = form.getField({ id: CUSTOM_FIELDS.END_DATE });
                let pag = form.getField({ id: CUSTOM_FIELDS.PAGE });
                let name = form.getField({ id: CUSTOM_FIELDS.NAME_PARTNER });

                card.defaultValue = params.card;
                dateStart.defaultValue = params.start;
                dateFinal.defaultValue = params.end;
                pag.defaultValue = params.page;
                name.defaultValue = params.name;
            } catch (error) {
                log.error({ title: 'error updateFields', details: error });
            }
        }

        /**
         * @summary Function that divides in block my array
         * @param {*} data 
         * @returns The data in blocks
         */
        const bloques = (data) =>{
            try {
                const BLOCK_RESULTS = 10;
                log.audit('getInputData ~ BLOCK_RESULTS:', BLOCK_RESULTS)
                const BLOCKS_DATA = []
                for (let i = 0; i < data.length; i += BLOCK_RESULTS) {
                    const block = data.slice(i, i + BLOCK_RESULTS)
                    if (block.length > 0) {
                        BLOCKS_DATA.push(block)
                    }
                }
                log.audit({ title: 'BLOCKS_DATA.length', details: BLOCKS_DATA.length });
                return BLOCKS_DATA
            } catch (e) {
                log.error({ title: 'Error bloques:', details: e });
            }
        }

        /**
         * @summary Function that add the values to the sublist
         * @param {*} objSearch 
         * @param {*} form 
         */
        const addSublist = (objSearch, form, page, pagina) =>{
            try {
                // pagina.defaultValue;
                var paginas = objSearch.map((value, index) => { return { text: `Pagina ${index + 1}`, value: index } });

                paginas.forEach(pag => {//add the result of pagination
                    pagina.addSelectOption(pag)
                })

                // log.debug({ title: 'objSearch', details: objSearch });
                var sublist = form.getSublist({ id: 'sublistid_pl_account_edo_results' });
                var auxIndex = 0;
                objSearch[page].forEach((element, index) => {
                    // log.debug({title:'element index: ' + index, details:{auxindex: auxIndex, element: element}});
                    // if (element.numTransaction == '-' && element.typeTransaction == 'Venta') {
                    //     log.debug({title:'Dato excluido', details:element});
                    // }else{
                        if (element.recordType != '- None -') {
                            var transactionLink = url.resolveRecord({ recordType: element.recordType, recordId: element.internalid, isEditMode: false });
                            log.debug({ title: 'transactionLink', details: transactionLink });
                            // '<a href="' + outputCheck + '" target="_blank"> # ' + dataPage[j].tranid + '</a>'        
                            sublist.setSublistValue({ id: CUSTOM_SUBLIST.TRANSACTION, line: auxIndex, value: "<a href=" + transactionLink + ">" + element.numTransaction + "</a>" });
                        } else {
                            sublist.setSublistValue({ id: CUSTOM_SUBLIST.TRANSACTION, line: auxIndex, value: element.numTransaction });
                        }
                        sublist.setSublistValue({ id: CUSTOM_SUBLIST.DATE, line: auxIndex, value: element.dateCreation });
                        sublist.setSublistValue({ id: CUSTOM_SUBLIST.TYPE, line: auxIndex, value: element.typeTransaction || "-" });
                        sublist.setSublistValue({ id: CUSTOM_SUBLIST.LOCATION, line: auxIndex, value: (element.location) != " " ? (element.location) : "" });
                        sublist.setSublistValue({ id: CUSTOM_SUBLIST.BONUS_POINTS, line: auxIndex, value: element.bonusPoints || "0" });
                        sublist.setSublistValue({ id: CUSTOM_SUBLIST.POINTS_USED, line: auxIndex, value: (element.pointsUsed) != '- None -' ? (element.pointsUsed) : "0" });
                        sublist.setSublistValue({ id: CUSTOM_SUBLIST.AMMOUNT_TRANSACTION, line: auxIndex, value: element.ammountTransaction });
                        sublist.setSublistValue({ id: CUSTOM_SUBLIST.ORIGEN, line: auxIndex, value: element.origen });
                        auxIndex++;
                    // }
                });
            } catch (error) {
                log.error({ title: 'error addSublist', details: error });
            }
        }


        /**
         * @summary Function that search the data of the transaction and the record
         * @param {*} params 
         * @returns [array] Returns the two arrays with both information, the information about the save search PL and the new search
         */
        const searchData = (params) =>{
            try {
                //Receive the params of the filters, in both cases
                const cardNumber = params.custpage_pl_partner_number || params.card;
                const startDate = params.custpage_pl_edo_soc_date_start || params.start;
                const endDate = params.custpage_pl_edo_soc_date_end || params.end;
                const objSearch = search.load({ id: 'customsearch_efx_pl_edo_cuenta_socio' });//load the save search of netsuite
                const data = []

                objSearch.filterExpression = [ //Add the filters to the save search  
                    ['created', search.Operator.WITHIN, startDate, endDate],
                    "AND",
                    ["custrecord_efx_lealtad_socioabonificar.custrecord_efx_lealtad_numtarjetasocio", search.Operator.ANYOF, cardNumber],
                    "AND",
                    ["custrecord_efx_lealtad.type", search.Operator.NONEOF, "CustCred", "VendCred","SalesOrd", "TrnfrOrd", "PurchOrd","VendAuth","RtnAuth"] //"CustCred", "VendCred", "SalesOrd", "TrnfrOrd", "PurchOrd","VendAuth"
                ]

                //Add the new columns to the save search
                objSearch.columns.push(search.createColumn({ name: 'location', summary: 'GROUP', join: 'CUSTRECORD_EFX_LEALTAD' }));
                objSearch.columns.push(search.createColumn({ name: 'total', summary: 'AVG', join: 'CUSTRECORD_EFX_LEALTAD' }));
                objSearch.columns.push(search.createColumn({ name: 'number', summary: 'GROUP', join: 'CUSTRECORD_EFX_LEALTAD' }));
                objSearch.columns.push(search.createColumn({ name: 'type', summary: 'GROUP', join: 'CUSTRECORD_EFX_LEALTAD' }));
                objSearch.columns.push(search.createColumn({ name: 'recordType', summary: 'GROUP', join: 'CUSTRECORD_EFX_LEALTAD' }));
                objSearch.columns.push(search.createColumn({ name: "internalid", join: "CUSTRECORD_EFX_LEALTAD", summary: "GROUP", label: "ID interno" }));
                data.push({ filters: objSearch.filters, columns: objSearch.columns })

                let records = [];//Array that contains the information about the search PL- Redenciones
                var searchResultCount = objSearch.runPaged().count;
                var myPagedResults = objSearch.runPaged({
                    pageSize: 1000
                });
                var thePageRanges = myPagedResults.pageRanges;

                for (var i in thePageRanges) {
                    var thepageData = myPagedResults.fetch({ index: thePageRanges[i].index });
                    thepageData.data.forEach(function (result) {
                        var used = '0', bonus = '0';
                        let typeMov = result.getValue({ name: "custrecord_efx_lealtad_tipobonifredem", summary: "GROUP" });
                        let typTransaction = result.getText({ name: "custrecord_efx_lealtad_metodobonifredenc", summary: "GROUP" });
                        if (typeMov == '1') {
                            if (typTransaction == 'Cierre de año' || typTransaction == 'Manual' || typTransaction == 'Nuevo Socio' || typTransaction == 'Bono de Cumpleaños' || typTransaction == 'Bono Visitas') {
                                bonus = (result.getValue({
                                    name: "formulanumeric",
                                    summary: "GROUP",
                                    formula: "CASE WHEN {custrecord_efx_lealtad_tipobonifredem} = 'Bonificación' THEN {custrecord_efx_lealtad_puntosabonados} ELSE {custrecord_efx_lealtad_puntosabonados}*-1 END"
                                }));

                            } else {
                                bonus = (result.getValue({ name: "custcol_efx_lealtad_puntosabonificar", join: "CUSTRECORD_EFX_LEALTAD", summary: "SUM" })) != "" ? (result.getValue({ name: "custcol_efx_lealtad_puntosabonificar", join: "CUSTRECORD_EFX_LEALTAD", summary: "SUM" })) : '0';
                                let retAux = (result.getValue({ name: "custbody_efx_lealtad_pnts_use_so", join: "CUSTRECORD_EFX_LEALTAD", summary: "GROUP", type: "text" }));
                                if (retAux != '0' && retAux != '- None -') {
                                    used = (result.getValue({ name: "custbody_efx_lealtad_pnts_use_so", join: "CUSTRECORD_EFX_LEALTAD", summary: "GROUP", type: "text" })) != '' ? (result.getValue({ name: "custbody_efx_lealtad_pnts_use_so", join: "CUSTRECORD_EFX_LEALTAD", summary: "GROUP", type: "text" })) : '0'
                                } else {
                                    used = '0'
                                }
                            }
                        } else if (typeMov == '2') {
                            log.debug({ title: 'entre a redencion ', details: 'entre a redencion' });
                            if (typTransaction == 'Venta') {
                                used = (result.getValue({
                                    name: "custbody_efx_lealtad_pnts_use_so",
                                    join: "CUSTRECORD_EFX_LEALTAD",
                                    summary: "GROUP",
                                    type: "text"
                                })) != '- None -' ? (result.getValue({
                                    name: "custbody_efx_lealtad_pnts_use_so",
                                    join: "CUSTRECORD_EFX_LEALTAD",
                                    summary: "GROUP",
                                    type: "text"
                                })) : '0';
                                bonus: '0'
                            } else {
                                used = (result.getValue({
                                    name: "formulanumeric",
                                    summary: "GROUP",
                                    formula: "CASE WHEN {custrecord_efx_lealtad_tipobonifredem} = 'Bonificación' THEN {custrecord_efx_lealtad_puntosabonados} ELSE {custrecord_efx_lealtad_puntosabonados}*-1 END",
                                    label: "Puntos"
                                }));
                                bonus: '0'
                            }
                        }
                        let objRecord = {
                            typeMov: result.getValue({ name: "custrecord_efx_lealtad_tipobonifredem", summary: "GROUP" }),
                            recordType: (result.getValue({ name: 'recordType', summary: 'GROUP', join: 'CUSTRECORD_EFX_LEALTAD' })) || ' ',
                            internalid: (result.getValue({ name: "internalid", join: "CUSTRECORD_EFX_LEALTAD", summary: "GROUP" })) || ' ',
                            dateCreation: (result.getValue({ name: 'created', summary: 'GROUP' ,sort:search.Sort.DESC})).split(" ")[0],
                            typeTransaction: result.getText({ name: "custrecord_efx_lealtad_metodobonifredenc", summary: "GROUP" }),
                            typeTransCode: result.getValue({ name: "custrecord_efx_lealtad_metodobonifredenc", summary: "GROUP" }),
                            numTransaction: (result.getValue({ name: 'number', summary: 'GROUP', join: 'CUSTRECORD_EFX_LEALTAD' })) != '- None -' ? (result.getValue({ name: 'number', summary: 'GROUP', join: 'CUSTRECORD_EFX_LEALTAD' })) : '-',
                            location: (result.getText({ name: 'location', summary: 'GROUP', join: 'CUSTRECORD_EFX_LEALTAD' })) != '- None -' ? (result.getText({ name: 'location', summary: 'GROUP', join: 'CUSTRECORD_EFX_LEALTAD' })) : "-",
                            bonusPoints: bonus,
                            pointsUsed: Math.abs(used),
                            ammountTransaction: (result.getValue({ name: 'total', summary: 'AVG', join: 'CUSTRECORD_EFX_LEALTAD' })) != '.00' ? (result.getValue({ name: 'total', summary: 'AVG', join: 'CUSTRECORD_EFX_LEALTAD' })) : '0.00',
                            origen: 'Historicos'
                        }
                        records.push(objRecord);
                        return true
                    });
                }
                log.debug({ title: 'records', details: records });
                records = records.filter(records => records.typeTransCode != '2');//Filter the data, if the type is 'pago con puntos' don't take him
                let transactions = searchTransaction(params);
                let arrMovements = [...records, ...transactions];

                arrMovements.sort(function(a, b) {
                    var dateA = new Date(a.dateCreation.split("/").reverse().join("/"));
                    var dateB = new Date(b.dateCreation.split("/").reverse().join("/"));
                    return dateB - dateA;
                });
                var formatData = excludeData(arrMovements);
                log.debug({title:'formatData', details:formatData});
                if (formatData.success == false) {
                    throw formatData.error;
                }
                return formatData.data;
            } catch (error) {
                log.error({ title: 'error searchData: ', details: error });
                return [];
            }
        }

        function excludeData(movements) {
            const response = {success: false, error: '', data: []};
            try {
                log.debug({title:'movements_look: length_' + movements.length, details:movements});
                for (var movement = 0; movement < movements.length; movement++) {
                    var element = movements[movement];
                    if (element.numTransaction == '-' && element.typeTransaction == 'Venta') {
                        log.debug({title:'Dato excluido', details:element});
                    }else{
                        response.data.push(element);
                    }
                }
                response.success = true;
            } catch (error) {
                log.error({title:'excludeData', details:error});
                response.success = false;
                response.error = error;
            }
            return response;
        }

        /**
         * @summary Function that search the information about the transactions of the partners Programa de lealtad
         * @param {*} params The filters of the screen 
         * @returns  [array] Returns the array about the information of the new Search
         */
        const searchTransaction = (params) =>{
            try {
                const startDate = params.custpage_pl_edo_soc_date_start || params.start;
                const endDate = params.custpage_pl_edo_soc_date_end || params.end;
                const cardNumber = params.custpage_pl_partner_number || params.card;

                var transactionSearchObj = search.create({
                    type: search.Type.TRANSACTION,
                    filters:
                        [
                            ["mainline", search.Operator.IS, "T"],
                            "AND",
                            ["trandate", search.Operator.WITHIN, startDate, endDate],
                            "AND",
                            ["custbody_efx_lealtad_bonificacionexito", search.Operator.IS, "F"],//CAMBIAR A FALSE
                            "AND",
                            ["custbody_efx_lealtad_prtnr_relation.custrecord_efx_lealtad_numtarjetasocio", search.Operator.ANYOF, cardNumber],
                            "AND",
                            ["type", search.Operator.NONEOF, "CustCred", "VendCred", "SalesOrd", "TrnfrOrd", "PurchOrd","VendAuth","RtnAuth"],//VendAuth
                            "AND",
                            ["custrecord_efx_lealtad.custrecord_efx_lealtad", search.Operator.ANYOF, "@NONE@"],
                            "AND", 
                            ["custbody_efx_fe_kiosko_name","isempty",""], 
                            "AND", 
                            ["custbody_efx_fe_kiosko_rfc","isempty",""], 
                            "AND", 
                            ["custbody_efx_fe_kiosko_address","isempty",""], 
                            "AND", 
                            ["custbody_efx_fe_kiosko_customer","anyof","@NONE@"]
                        ],
                    columns:
                        [
                            search.createColumn({ name: "trandate", label: "Date",sort:search.Sort.ASC }),
                            search.createColumn({ name: "internalid", label: "id interno" }),
                            search.createColumn({ name: "type", label: "tipo" }),
                            search.createColumn({ name: "tranid", label: "Document Number" }),
                            search.createColumn({ name: "location", label: "Location" }),
                            search.createColumn({ name: "custbody_efx_lealtad_puntostot_report", label: "PL - Puntos Totales Bonificados Reporteo" }),
                            search.createColumn({ name: "custbody_efx_lealtad_pnts_use_so", label: "PUNTOS A UTILIZAR COMO PAGO" }),
                            search.createColumn({ name: "amount", label: "Amount" }),
                            search.createColumn({
                                name: "formulatext",
                                formula: "CASE WHEN {type} = 'SalesOrd'  OR   {type} = 'CashSale' OR   {type} = 'CustInvc' THEN 'Venta'  ELSE 'hola' END",
                                label: "Fórmula (texto)"
                            }),
                            search.createColumn({ name: "recordType", label: "RecordType" }),
                        ]
                });
                var searchResultCount = transactionSearchObj.runPaged().count;
                log.debug("transactionSearchObj result count", searchResultCount);

                var myPagedResults = transactionSearchObj.runPaged({
                    pageSize: 1000
                });
                var thePageRanges = myPagedResults.pageRanges;
                let arrTransactions = []
                for (var i in thePageRanges) {
                    var thepageData = myPagedResults.fetch({ index: thePageRanges[i].index })
                    thepageData.data.forEach(function (result) {
                        let objTransactions = {
                            internalid: result.getValue({ name: 'internalid' }),
                            recordType: result.getValue({ name: 'recordType' }),
                            dateCreation: result.getValue({ name: 'trandate' ,sort:search.Sort.ASC}),
                            typeTransaction: (result.getValue({ name: 'type' })) == 'CashSale' || (result.getValue({ name: 'type' })) == ('CustInvc') || (result.getValue({ name: 'type' })) == ('SalesOrd') ? 'Ventas' : ' ',
                            numTransaction: result.getValue({ name: 'tranid' }),
                            location: result.getText({ name: 'location' }),
                            bonusPoints: (result.getValue({ name: 'custbody_efx_lealtad_puntostot_report' })) ? (result.getValue({ name: 'custbody_efx_lealtad_puntostot_report' })): 0,
                            pointsUsed: (result.getValue({ name: 'custbody_efx_lealtad_pnts_use_so' })) ? (result.getValue({ name: 'custbody_efx_lealtad_pnts_use_so' })) : 0 ,
                            ammountTransaction: result.getValue({ name: 'amount' }),
                            origen: 'transacciones'
                        }
                        arrTransactions.push(objTransactions);
                        return true;
                    });
                }

                log.debug({ title: 'arrTransactions', details: arrTransactions });
                return arrTransactions;
            } catch (error) {
                log.error({ title: 'error Search Transaction', details: error });
                return [];
            }
        }
        /**
         * @summary Funtion that create the interface in netsuite
         * @returns The interface
         */
        const createInterface = (params) =>{
            try {
                var form = serverWidget.createForm({
                    title: 'Estado de Cuenta Socios'
                });

                form.clientScriptModulePath = './tkiio_pl_estados_cuenta_socio_cs.js';

                form.addSubmitButton({
                    id: CUSTOM_BUTTONS.FILTER,
                    label: 'Filtrar'
                });

                form.addButton({
                    id: CUSTOM_BUTTONS.PRINT,
                    label: 'Imprimir',
                    functionName: 'printData'
                });

                var fieldgroup = form.addFieldGroup({
                    id: CUSTOM_CONTAINER.FILTERS,
                    label: 'Filtros'
                });

                var partnerNumber = form.addField({
                    id: CUSTOM_FIELDS.CREDIT_NUM,
                    type: serverWidget.FieldType.SELECT,
                    label: "Número Tarjeta",
                    source: CUSTOM_SOURCE.NUM_CREDIT,
                    container: CUSTOM_CONTAINER.FILTERS
                });

                var namePartner = form.addField({
                    id: CUSTOM_FIELDS.NAME_PARTNER,
                    type: serverWidget.FieldType.TEXT,
                    label: "Nombre Socio",
                    container: CUSTOM_CONTAINER.FILTERS
                }).updateDisplayType({
                    displayType: serverWidget.FieldDisplayType.DISABLED
                });

                var startDate = form.addField({
                    id: CUSTOM_FIELDS.START_DATE,
                    type: serverWidget.FieldType.DATE,
                    label: 'Fecha Inicio',
                    container: CUSTOM_CONTAINER.FILTERS
                });

                var endDate = form.addField({
                    id: CUSTOM_FIELDS.END_DATE,
                    type: serverWidget.FieldType.DATE,
                    label: 'Fecha Final',
                    container: CUSTOM_CONTAINER.FILTERS
                });

                var page = form.addField({
                    id: CUSTOM_FIELDS.PAGE,
                    type: serverWidget.FieldType.SELECT,
                    label: 'Página',
                    container: CUSTOM_CONTAINER.FILTERS
                });

                // var filtros = form.addField({
                //     id: CUSTOM_FIELDS.FILTERS,
                //     type: serverWidget.FieldType.TEXT,
                //     label: "Filtros",
                //     container: CUSTOM_CONTAINER.FILTERS
                // }).updateDisplayType({
                //     displayType: serverWidget.FieldDisplayType.DISABLED
                // });

                // var resultNum = form.addField({
                //     id: 'custpage_text_result_num',
                //     type: serverWidget.FieldType.INTEGER,
                //     label: 'Cantidad de resultados',
                //     container: CUSTOM_CONTAINER.FILTERS
                // });

                startDate.isMandatory = true;
                endDate.isMandatory = true;
                partnerNumber.isMandatory = true;

                partnerNumber.defaultValue = params.custpage_pl_partner_number;
                namePartner.defaultValue = params.custpage_pl_partner_name;
                startDate.defaultValue = params.custpage_pl_edo_soc_date_start;
                endDate.defaultValue = params.custpage_pl_edo_soc_date_end;

                //Create the sublist
                var sublist = form.addSublist({
                    id: 'sublistid_pl_account_edo_results',
                    type: serverWidget.SublistType.LIST,
                    label: 'Resultados'
                });

                var date = sublist.addField({
                    id: CUSTOM_SUBLIST.DATE,
                    type: serverWidget.FieldType.TEXT,
                    label: 'Fecha'
                });

                var typeTransaction = sublist.addField({
                    id: CUSTOM_SUBLIST.TYPE,
                    type: serverWidget.FieldType.TEXT,
                    label: 'Tipo'
                });

                var numTransaction = sublist.addField({
                    id: CUSTOM_SUBLIST.TRANSACTION,
                    type: serverWidget.FieldType.TEXT,
                    label: 'Transacción'
                });


                var sucursal = sublist.addField({
                    id: CUSTOM_SUBLIST.LOCATION,
                    type: serverWidget.FieldType.TEXT,
                    label: 'Sucursal'
                });

                var ptosBonificados = sublist.addField({
                    id: CUSTOM_SUBLIST.BONUS_POINTS,
                    type: serverWidget.FieldType.TEXT,
                    label: 'Puntos Bonificados'
                });

                var ptosUtilizados = sublist.addField({
                    id: CUSTOM_SUBLIST.POINTS_USED,
                    type: serverWidget.FieldType.TEXT,
                    label: 'Puntos Utilizados'
                });

                var totalTicket = sublist.addField({
                    id: CUSTOM_SUBLIST.AMMOUNT_TRANSACTION,
                    type: serverWidget.FieldType.FLOAT,
                    label: 'Total de Ticket'
                });

                var origen = sublist.addField({
                    id: CUSTOM_SUBLIST.ORIGEN,
                    type: serverWidget.FieldType.TEXT,
                    label: 'Origen'
                });
                origen.updateDisplayType({
                    displayType: serverWidget.FieldDisplayType.HIDDEN
                });
                return form;

            } catch (error) {
                log.error({ title: '*Error on createInterface', details: error });
                var formerror = errForm(error);
                scriptContext.response.writePage({
                    pageObject: formerror
                })
            }
        }

        /**
         * @summary Function that create the error page
         * @param {*} details 
         * @returns 
         */
        const errForm = (details) =>{
            try {
                var form = serverWidget.createForm({
                    title: "Formulario de captura"
                });
                var htmlfld = form.addField({
                    id: "custpage_msg_error",
                    label: " ",
                    type: serverWidget.FieldType.INLINEHTML
                });
                htmlfld.defaultValue = '<b>HA OCURRIDO UN ERROR; CONTACTE A SUS ADMINISTRADORES.</b>' +
                    '<br>Detaller:</br>' + JSON.stringify(details);
                return form;
            } catch (error) {
                log.error({ title: 'errForm error', details: error });
            }
        }

        return { onRequest }

    });
