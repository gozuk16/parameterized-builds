define('trigger/build-dialog', [
    'aui',
    'jquery',
    'exports',
    'bitbucket/internal/model/page-state',
    'bitbucket/internal/util/ajax',
    'aui/flag'
], function(
    _aui,
    $,
    exports,
    pageState,
    ajax,
    flag
) {
	var branchName;
	var jobs;
	
	function getResourceUrl(resourceType){
		return _aui.contextPath() + '/rest/parameterized-builds/latest/projects/' + pageState.getProject().getKey() + '/repos/'
        + pageState.getRepository().getSlug() + '/' + resourceType;
	}
    
	function getJobs(resourceUrl){
		var results;
		$.ajax({
		  type: "GET",
		  url: resourceUrl,
		  dataType: 'json',
		  async: false,
		  success: function (data){
			  results = data;
		  }
		});
		return results;
	}
	
	function triggerBuild(buildUrl){
		var successFlag = flag({
            type: 'success',
            body: 'Build started',
            close: 'auto'
        });
		ajax.rest({
		  type: "POST",
		  url: buildUrl,
		  dataType: 'json',
		  async: true
		}).success(function (data) {
			var buildStatus = data.status;
    		var buildMessage = data.message;
    		if (buildStatus !== "201"){
    			successFlag.close();
    			flag({
                    type: 'warning',
                    body: buildMessage,
                    close: 'auto'
                });
    		}
		});
	};
	
    function getParameterArray(jobId){
    	var parameterArray = [];
		var params = jobs[jobId].parameters;
		for (var param in params){
			var val = params[param];
			parameterArray.push([param, val.split(";")]);
		}
		return parameterArray;
    };
    
	function SetupJobForm(element, jobId) {
		//Remove previous elements
		var $container = $('.job-params');
		$container.remove();
		var parameterArray = getParameterArray(jobId);
		var html = com.kylenicholls.stash.parameterizedbuilds.jenkins.branchBuild.createParams({
            'count' : parameterArray.length,
            'branchName' : branchName,
            'parameters' : parameterArray
        });
        $(html).insertAfter(element);
	};
	
	$(document).on('change', '#job', function(e) {
    	e.preventDefault();
    	SetupJobForm(this, this.value);
    });
	
    function showManualBuildDialog(buildUrl, jobIdArray) {
    	
        var dialog = _aui.dialog2(aui.dialog.dialog2({
            titleText: AJS.I18n.getText('Build with Parameters'),
            content: com.kylenicholls.stash.parameterizedbuilds.jenkins.branchBuild.buildDialog({
                jobs: jobIdArray
            }),
            footerActionContent: com.kylenicholls.stash.parameterizedbuilds.jenkins.branchBuild.buildButton(),
            removeOnHide: true
        })).show();
        
        var selects = document.getElementById("job");
        var selectedValue = selects.options[selects.selectedIndex].value;
        SetupJobForm(selects, selectedValue);
        
        dialog.$el.find('form').on('submit', function(e) { e.preventDefault(); });
        dialog.$el.find('#start-build').on('click', function() {
            _.defer(function() {
            	var $jobParameters = dialog.$el.find('.web-post-hook');
            	var jobSelect = document.getElementById("job");
                var id = selects.options[selects.selectedIndex].value;
            	buildUrl += "/" + jobs[id].id + "?";
            	$jobParameters.each(function(index, jobParam) {
            		var $curJobParam = $(jobParam);
            		var key = $curJobParam.find('label').text();
            		var value = dialog.$el.find('#build-param-value-' + index).val();
            		var type = $(dialog.$el.find('#build-param-value-' + index)[0]).attr('class');
            		if (type.indexOf("checkbox") > -1) {
            			value = dialog.$el.find('#build-param-value-' + index)[0].checked;
            		}
            		buildUrl += key + "=" + value + "&";
            	});
            	triggerBuild(buildUrl.slice(0,-1));
                dialog.hide();
            });
        }).focus().select();
    }
	
	function bindToDropdownLink(linkSelector, dropDownSelector, getBranchNameFunction) {
        //selecting on the document as the drop down is absolutely positioned and may not have a parent other than the document
        $(document).on('aui-dropdown2-show', dropDownSelector, function () {
        	var $dropdownMenu = $(this);
        	var $buildTriggerButton = $(linkSelector);
            branchName = getBranchNameFunction($dropdownMenu);

            var triggerBuildSetup = function() {
            	var resourceUrl = getResourceUrl("getJobs");
            	
            	jobs = getJobs(resourceUrl);
            	var jobArray = [];
            	for (var i in jobs){
            		jobArray.push(jobs[i]);
         	    }
            	
            	if (jobArray.length == 1){
            		parameters = getParameterArray("0");
                	if (parameters.length == 0){
                		var buildUrl = getResourceUrl("triggerBuild/0");
                		triggerBuild(buildUrl);
                	} else if (parameters.length == 1 && parameters[0][1] == "$BRANCH") {
                		var buildUrl = getResourceUrl("triggerBuild/0");
                		triggerBuild(buildUrl + "?" + parameters[0][0] + "=" + branchName);
                	} else {
                		var buildUrl = getResourceUrl("triggerBuild");
                		showManualBuildDialog(buildUrl, jobArray);
                	}
            	} else {
            		var buildUrl = getResourceUrl("triggerBuild");
                	showManualBuildDialog(buildUrl, jobArray);
            	}
            	return false
            };
            
            $buildTriggerButton.on('click', triggerBuildSetup);
            $dropdownMenu.on('aui-dropdown2-hide', function() {
            	$buildTriggerButton.off('click', triggerBuildSetup);
            });
            return false;
        });
    };
	
    exports.bindToDropdownLink = bindToDropdownLink;
});