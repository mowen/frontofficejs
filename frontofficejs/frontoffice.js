var ACTIVITY_DATA;
var XML_STRING;

var FORM_DEFINITION_DIV = "#form-definition";
var VISIBILITY_DIV = "#visibility-rules";
var AFFECTED_CONTROLS_DIV = "#affected-controls";
var ACTIVITY_PAGE_CLASS = "activity-page";

$(document).ready(
  function () {
    showActivitiesDialog();
  }
);

function showActivitiesDialog() {
  $("#select-activity-form").dialog(
    {
      bgiframe: true,
      autoOpen: false,
      height: 100,
      modal: true,
      buttons: {
        'OK': function() {
	  var activityId = $("input#activity-name").val();
	  $("input#activity-name").val("");
	  showActivityXml(activityId);
	  if (ACTIVITY_DATA.hasData()) {
	    $(this).dialog("close");
	  }
	}
      },
      close: function() { }
    }
  );

  $("#select-activity-form").dialog("open");

  if ($("input#activity-name").val() == "") {
    hideHeaderAndTabs();
  }
}

function showActivityXml(activityId) {
  var filename = activityId.toUpperCase() + ".xml";
  ACTIVITY_DATA = new ActivityData(filename);

  if (ACTIVITY_DATA.hasData()) {
    ACTIVITY_DATA.addSimpleRulesToComplexRules();
    ACTIVITY_DATA.getAffectedControls();
    ACTIVITY_DATA.displayAll();
    $("#tabs").tabs();
    $("#txtLiveSearch").keyup(
      function(event) {
	var searchTerm = this.value;
	ACTIVITY_DATA.liveSearch(searchTerm);
      }
    );
    $("#header").show();
    $("#tabs").show();
  }
}

function hideHeaderAndTabs() {
  $("#header").hide();
  $("#tabs").hide();
}

function ActivityData(xmlFilename) {
  this.data = this._initServiceData(xmlFilename);
  if (this.data != null) {
    this.visibilityRules = this._initVisibilityRules();
    this.formDefinition = this._initFormDefinition();
    this._addControlsToVisibilityRules();
  }
  else {
    alert("A file with the name '" + xmlFilename + "' couldn't be found.");
  }
}

// TODO: Implement eachVisibilityRule(func) and eachControl(func) Visitor functions.
ActivityData.prototype = {

  displayAll: function() {
    this._displayHeader();
    this._displayVisibility();
    //this._displayAffectedControls();
    this._displayPages();
  },

  liveSearch: function(searchTerm) {
    this._searchVisibility(searchTerm);
    this._searchFormDefinition(searchTerm);
  },

  hasData: function() {
    return (this.data != null);
  },

  _searchVisibility: function(searchTerm) {
    for (var ruleId in this.visibilityRules) {
      var ruleName = this.visibilityRules[ruleId].RuleName;
      var element = $("#" + ruleName);
      if (this.visibilityRules[ruleId].matchesSearchTerm(searchTerm)) {
	element.parent().show();
      }
      else {
	element.parent().hide();
      }
    }
  },

  _searchFormDefinition: function(searchTerm) {
    this.formDefinition.eachTable(
      function(table) {
	var tableName = table.name;
	var element = $("#" + tableName);
	if (tableName.isIncrementalMatch(searchTerm)) {
	  element.parent().show();
	}
	else {
	  element.parent().hide();
	}
      });
  },

  _displayHeader: function() {
    $("<h1>" + this.data.ActivityName + " - " + this.data.Description + "</h1>").prependTo("#header");
  },

  _displayVisibility: function() {
    var tableHtml = '<table>';
    tableHtml += "<thead><tr><th>Name</th><th colspan=\"3\">Rule</th><th>Controls</th></tr></thead>";

    tableHtml += "<tbody id=\"visibility-table\">";

    for (var ruleId in this.visibilityRules) {
      var rule = this.visibilityRules[ruleId];
      tableHtml += rule.emitHtml();
    }

    tableHtml += "</tbody></table>";

    $(tableHtml).appendTo(VISIBILITY_DIV);
  },

  _displayAffectedControls: function() {
    var affectedControlsHtml = "<pre>";
    affectedControlsHtml += this.affectedControls.emitDigraph();
    affectedControlsHtml += "</pre>";

    $(affectedControlsHtml).appendTo(AFFECTED_CONTROLS_DIV);
  },

  _displayPages: function() {
    this.formDefinition.displayPages();
  },

  _loadXmlDoc: function(filename) {
    $.ajax({
      url: filename,
      dataType: "text",
      async: false,
      success: function(data){
	XML_STRING = data;
      },
      error: function() {
	XML_STRING = null;
      }
   });
  },

  _initServiceData: function(filename) {
    this._loadXmlDoc(filename); // Populates XML_STRING

    if (XML_STRING == null) {
      return null;
    }
    else {
      return $.xml2json(XML_STRING);
    }
  },

  _initFormDefinition: function() {
    var rawFormDefinition = this.data.FormDefinition;
    return new FormDefinition(rawFormDefinition);
  },

  _initVisibilityRules: function() {
    var simpleRules = this.data.VisibilityRules.VisibilityObjectsDataSet.Rules;
    var complexRules = this.data.VisibilityRules.VisibilityObjectsDataSet.RulesMaster;
    var rules = new Array();

    var i;
    for (i = 0; i < simpleRules.length; i++)
      rules[simpleRules[i].RulesId.toString()] = new SimpleVisibilityRule(simpleRules[i]);

    // The XML to JSON converter will not use an Array if there is only a single child.
    // TODO: Extract this check, as it is needed by the pages too.
    if (complexRules != undefined) {
      if (complexRules.length != undefined) {
	for (i = 0; i < complexRules.length; i++) {
	  rules[complexRules[i].RulesMasterId.toString()] = new ComplexVisibilityRule(complexRules[i]);
	}
      }
      else {
	rules[complexRules.RulesMasterId.toString()] = new ComplexVisibilityRule(complexRules);
      }
    }

    return rules;
  },

  _addControlsToVisibilityRules: function() {
    var rule, control;
    var controls = this.data.VisibilityRules.VisibilityObjectsDataSet.Controls;

    for (var i = 0; i < controls.length; i++) {
      control = controls[i];
      if (control.VisibleOnLoad == "N") {
	rule = this.visibilityRuleByName(control.VisibilityRuleName);
	rule.addControl(control);
      }
    }
  },

  addSimpleRulesToComplexRules: function() {
    var visibilityRules = ACTIVITY_DATA.visibilityRules;

    for (var ruleId in visibilityRules) {
      var rule = visibilityRules[ruleId];
      if (rule.RulesCode != undefined) {
	var complexRuleParser = new ComplexRuleParser(rule.RulesCode);
	rule.RulesDescription = complexRuleParser.parse();
	rule.simpleRules = complexRuleParser.simpleRules;
      }
    }
  },

  getAffectedControls: function() {
    this.affectedControls = new AffectControls();
  },

  visibilityRuleByName: function(ruleName) {
    for (var ruleId in this.visibilityRules) {
      if (this.visibilityRules[ruleId].RuleName == ruleName)
	return this.visibilityRules[ruleId];
    }
    return null;
  },

  searchForRule: function(ruleId) {
    $("#txtLiveSearch").val(ruleId);
    ACTIVITY_DATA.liveSearch(ruleId);
    $("#tabs").tabs('select', VISIBILITY_DIV);
  }

};

function SimpleVisibilityRule(rule) {
  this.RuleName = rule.RuleName;
  this.RulesId = rule.RulesId;
  this.controls = new Array();
  this.ControlName = rule.ControlName;
  this.Operator = rule.Operator;
  this.Val = rule.Val;
}

SimpleVisibilityRule.prototype = {

  addControl: function(control) {
    this.controls.push(control);
  },

  emitHtml: function() {
    var html = "<tr class=\"ui-widget-content\">";
    html += "<td>" + this.RuleName + "</td>";
    html += "<td colspan=\"3\" class=\"rule-description\" id=\"" + this.RuleName + "\">" + this.emitRuleDescription() + "</td>";
    html += "<td>";
    html += this._emitControlsCSV();
    html += "</td>";
    html += "</tr>";
    return html;
  },

  // TODO: Don't add the onClick functions here,
  // add them after the HTML has been rendered
  emitRuleDescription: function() {
    var affectedControls = this._emitControlsCSV();
    var ruleHtml = "<span title=\"Id: " + this.RulesId
                 + ", Name: " + this.RuleName
                 + ", Controls: " + affectedControls
                 + "\" class=\"simple-rule\" "
                 + "onClick=\"javascript:ACTIVITY_DATA.searchForRule('" + this.RulesId + "');\">";
    ruleHtml += this.ControlName + "&nbsp;" + this._convertOperator(this.Operator) + "&nbsp;" + this.Val;
    ruleHtml += "</span>";
    return ruleHtml;
  },

  _convertOperator: function(operator) {
    var newOperator = operator;

    if (operator == "=")
      newOperator = "==";
    else if (operator == "!")
      newOperator = "!=";

    return newOperator;
  },

  _emitControlsCSV: function() {
    var html = "";

    for (var i = 0; i < this.controls.length; i++) {
      html += (i > 0) ? ", " : "";
      html += this.controls[i].ControlName;
    }

    return html;
  },

  matchesSearchTerm: function(searchTerm) {
    if (this.RulesId.isIncrementalMatch(searchTerm) ||
	this.RuleName.isIncrementalMatch(searchTerm) ||
	this.ControlName.isIncrementalMatch(searchTerm) ||
        this._controlMatchesSearchTerm(searchTerm)) {
      return true;
    }
    else {
      return false;
    }
  },

  _controlMatchesSearchTerm: function(searchTerm) {
    for (var i=0; i < this.controls.length; i++) {
      if (this.controls[i].ControlName.isIncrementalMatch(searchTerm)) {
	return true;
      }
    }

    return false;
  }

};

function ComplexVisibilityRule(rule) {
  this.RuleName = rule.RulesMasterName;
  this.RulesId = rule.RulesMasterId;
  this.RulesCode = rule.RulesMasterCode;
  this.controls = new Array();
}

ComplexVisibilityRule.prototype = {

  addControl: function(control) {
    this.controls.push(control);
  },

  emitHtml: function() {
    var html = "<tr class=\"ui-widget-content\">";
    html += "<td>" + this.RuleName + "</td>";
    html += "<td colspan=\"3\" class=\"rule-description\" id=\"" + this.RuleName + "\">" + this.emitRuleDescription() + "</td>";
    html += "<td>";
    html += this._emitControlsCSV();
    html += "</td>";
    html += "</tr>";
    return html;
  },

  emitRuleDescription: function() {
    return this.RulesDescription;
  },

  _emitControlsCSV: function() {
    var html = "";

    for (var i = 0; i < this.controls.length; i++) {
      html += (i > 0) ? ", " : "";
      html += this.controls[i].ControlName;
    }

    return html;
  },

  matchesSearchTerm: function(searchTerm) {
    if (this.RuleName.isIncrementalMatch(searchTerm) ||
	this.RulesId.isIncrementalMatch(searchTerm) ||
	this._simpleRuleMatchesSearchTerm(searchTerm) ||
        this._controlMatchesSearchTerm(searchTerm)) {
      return true;
    }
    else {
      return false;
    }
  },

  _simpleRuleMatchesSearchTerm: function(searchTerm) {
    for (var simpleRuleId in this.simpleRules) {
      if (this.simpleRules[simpleRuleId].matchesSearchTerm(searchTerm)) {
	return true;
      }
    }

    return false;
  },

  _controlMatchesSearchTerm: function(searchTerm) {
    for (var i=0; i < this.controls.length; i++) {
      if (this.controls[i].ControlName.isIncrementalMatch(searchTerm)) {
	return true;
      }
    }

    return false;
  }

};

function AffectControls() {
  var rawAffectControls = ACTIVITY_DATA.data.VisibilityRules.VisibilityObjectsDataSet.AffectControls;
  this.controls = new Array();
  for (var i=0; i < rawAffectControls.length; i++) {
    var control = rawAffectControls[i];
    this._addControl(control);
  }
}

AffectControls.prototype = {

  _controlExists: function(id) {
    return (this.controls[id] != null);
  },

  _addControl: function(control) {
    var id = control.ControlId;
    if (!this._controlExists(id)) {
      this.controls[id] = new AffectControl(id);
    }
    this._addAffControl(control.AffControlId);
    var affectControl = this.controls[control.AffControlId];
    this.controls[id].addAffectControl(affectControl);
  },

  _addAffControl: function(affControlId){
    if (!this._controlExists(affControlId)) {
      this.controls[affControlId] = new AffectControl(affControlId);
    }
  },

  /**
   * The digraph becomes impossible to read if we include everything, so
   * just limit via this function.
   */
  _includeControlInDigraph: function(control) {
    return control.id.match(/^table/);
  },

  /**
   * Output a directed graph in the "dot" language, to be interpreted by
   * GraphViz.
   */
  emitDigraph: function() {
    var digraph = "";

    digraph += "digraph G {\n";
    var control;
    for (controlId in this.controls) {
      control = this.controls[controlId];
      if (this._includeControlInDigraph(control)) {
	digraph += "\t" + control.id + " [label=\"" + control.name + "\"];\n";
	for (var i=0; i < control.affectedControls.length; i++) {
	  if (this._includeControlInDigraph(control.affectedControls[i])) {
	    digraph += "\t" + control.id + " -> " + control.affectedControls[i].id + ";\n";
	  }
	}
      }
    }
    digraph += "}";

    return digraph;
  }

};

function AffectControl(id) {
  this.id = id;
  this.name = this._findControlName();
  this.affectedControls = new Array();
}

AffectControl.prototype = {

  addAffectControl: function(affectControl) {
    this.affectedControls.push(affectControl);
  },

  // TODO: Is there a faster way to do this?
  _findControlName: function() {
    var control;
    var controls = ACTIVITY_DATA.data.VisibilityRules.VisibilityObjectsDataSet.Controls;
    for (var i=0; i < controls.length; i++) {
      control = controls[i];
      if (control.ControlId == this.id) {
	return control.ControlName;
      }
    }
    return "";
  }

};

function ComplexRuleParser(complexRuleDescription) {
  // Tokens are: "(", ")", "||", and "&&"
  this.TOKEN_REGEXP = new RegExp("^(\\(|\\)|\\|\\||&&)");
  this.ruleDescription = complexRuleDescription;
  this.expandedDescription = "";
  this.pos = 0;
  this.simpleRules = new Array();
}

ComplexRuleParser.prototype = {

  parse: function() {
    var simpleRuleId = "";
    var simpleRule;

    while (this.pos < this.ruleDescription.length) {
      if (this._isToken(this.ruleDescription.substr(this.pos)))
	this.expandedDescription += this._nextToken();
      else {
	while (!this._isToken(this.ruleDescription.substr(this.pos))) {
	  simpleRuleId += this.ruleDescription.charAt(this.pos);
	  this.pos++;
	}
	simpleRule = ACTIVITY_DATA.visibilityRules[simpleRuleId];
	this.expandedDescription += simpleRule.emitRuleDescription();
	this.simpleRules[simpleRuleId] = simpleRule;
	simpleRuleId = "";
      }
    }

    this.expandedDescription = this.expandedDescription.replace("&&", " AND ", "g"); // "g" means replace globally
    this.expandedDescription = this.expandedDescription.replace("||", " OR ", "g");

    return this.expandedDescription;
  },

  _isToken: function(s) {
    return s.match(this.TOKEN_REGEXP);
  },

  _nextToken: function() {
    var str = this.ruleDescription.substr(this.pos);
    var match = this.TOKEN_REGEXP.exec(str);
    var token = match[0];
    this.pos += token.length;
    return token;
  }

};

function FormDefinition(rawFormDefinition) {
  this.pages = this._initPages(rawFormDefinition.Page);
}

FormDefinition.prototype = {

  _initPages: function(rawPages) {
    var pages = new Array;

    var page;
    // TODO: Extract this check with the one in _initVisibilityRules().
    if (rawPages.length != undefined) {
      for (var i = 0; i < rawPages.length; i++) {
	page = new Control(rawPages[i]);
	page.initTables(rawPages[i].Table);
	pages[page.id.toString()] = page;
      }
    }
    else {
      page = new Control(rawPages);
      page.initTables(rawPages.Table);
      pages[page.id.toString()] = page;
    }

    return pages;
  },

  eachTable: function(func) {
    for (var pageId in this.pages) {
      var page = this.pages[pageId];
      for (var tableId in page.children) {
	var table = page.children[tableId];
	func(table);
      }
    }
  },

  displayPages: function() {
    var page;
    if (this.pages.length != undefined) {
      for (var pageId in this.pages) {
	page = this.pages[pageId];
	this._displayPage(page);
      }
    }
    else
      this._displayPage(page);
  },

  _displayPage: function(page) {
    var pageHtml = this._renderPage(page);
    $("#tabs-list").append("<li><a href=\"#" + page.id + "\">" + page.name + "</a></li>");
    $("#visibility-rules").before("<div id=\"" + page.id + "\" class=\"" + ACTIVITY_PAGE_CLASS + "\">" + pageHtml + "</div>");
    //this._addLiveSearchToTab(page.id);
  },

  _renderPage: function(page) {
    var html = "";

    html += this._renderRuleDescription(page);

    html += "<table>";
    html += "<thead><tr><th>Name</th><th>Visibility</th></tr></thead>";
    html += "<tbody>";

    var table;
    for (var childId in page.children)
      html += page.children[childId].render();

    html += "</tbody>";
    html += "</table>";

    return html;
  },

  _renderRuleDescription: function(page) {
    var ruleDescription = "";

    if (page.visibilityRuleName) {
      var rule = ACTIVITY_DATA.visibilityRuleByName(page.visibilityRuleName);
      ruleDescription = rule.emitRuleDescription();
    }
    else {
      ruleDescription = "None";
    }

    return "<p class=\"page-visibility-rule\">Visibility Rule:&nbsp;" + ruleDescription + "</p>";
  }

};

function Control(rawControl) {
  this.id = rawControl.id;
  this.name = rawControl.name;
  this.visibilityRuleName = rawControl.visibilityRuleName;
  this.children = new Array();
}

Control.prototype = {

  initTables: function(rawTables) {
    var table;
    for (var i=0; i < rawTables.length; i++) {
      table = new Control(rawTables[i]);
      this.children[table.id.toString()] = table;
    }
  },

  render: function() {
    var html;

    var visibilityRule = ACTIVITY_DATA.visibilityRuleByName(this.visibilityRuleName);
    html = "<tr>";
    html += "<td id=\"" + this.name + "\" title=\"" + this.id + "\">" + this.name + "</td>";

    if (visibilityRule == null)
      html += "<td></td>";
    else
      html += "<td title=\"" + visibilityRule.RuleName + "\">" + visibilityRule.emitRuleDescription() + "</td>";

    html += "</tr>";

    return html;
  },

  matchesSearchTerm: function(searchTerm) {
    if (this.id.isIncrementalMatch(searchTerm) ||
	this.name.isIncrementalMatch(searchTerm) ||
	this.visibilityRuleName.isIncrementalMatch(searchTerm) ||
	this._childMatchesSearchTerm(searchTerm)) {
      return true;
    }
    else {
      return false;
    }
  },

  _childMatchesSearchTerm: function(searchTerm) {
    if (this.children.length == 0) {
      return false;
    }
    else {
      for (var i=0; i < this.children.length; i++) {
	var childId = this.children[i];
	if (this.children[childId].matchesSearchTerm(searchTerm)) {
	  return true;
	}
      }
    }
    return false;
  }

};

String.prototype.isIncrementalMatch = function(searchTerm) {
  var trimmedText = this.substring(0, searchTerm.length);
  return (searchTerm == trimmedText);
};