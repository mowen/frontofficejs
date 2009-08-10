var ACTIVITY_DATA;

var FORM_DEFINITION_DIV = "#form-definition";
var VISIBILITY_DIV = "#visibility-rules";
var ACTIVITY_PAGE_CLASS = "activity-page";

// Document ready
$(document).ready(
  function () {
    ACTIVITY_DATA = new ActivityData("ENVPUBSR01.xml");
    ACTIVITY_DATA.displayAll();
    $("#tabs").tabs();
    $("#visibility-table").selectable();
    $("#txtLiveSearch").keyup(
      function(event) {
	var searchTerm = this.value;
	ACTIVITY_DATA.liveSearch(searchTerm);
      }
    );
  }
);

function ActivityData(xmlFilename) {
  this.data = this._initServiceData(xmlFilename);
  this.visibilityRules = this._initVisibilityRules();
  this.formDefinition = this._initFormDefinition();
  this._addControlsToVisibilityRules();
}

ActivityData.prototype = {

  displayAll: function() {
    this._displayHeader();
    this._displayVisibility();
    this._displayPages();
  },

  liveSearch: function(searchTerm) {
    this._searchVisibility(searchTerm);
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
    // Need to show or hide each individual element when we do the check
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

  _displayPages: function() {
    this.formDefinition.displayPages();
  },

  _loadXmlDoc: function(filename) {
    var xmlDoc;
    xmlDoc = new window.XMLHttpRequest();
    xmlDoc.open("GET", filename, false);
    xmlDoc.send("");
    return xmlDoc.responseText;
  },

  _initServiceData: function(filename) {
    var xml = this._loadXmlDoc(filename);
    return $.xml2json(xml);
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
    if (complexRules.length != undefined) {
      for (i = 0; i < complexRules.length; i++)
	rules[complexRules[i].RulesMasterId.toString()] = new ComplexVisibilityRule(complexRules[i]);
    }
    else
      rules[complexRules.RulesMasterId.toString()] = new ComplexVisibilityRule(complexRules);

    return rules;
  },

  _addControlsToVisibilityRules: function() {
    var rule, control;
    var controls = this.data.VisibilityRules.VisibilityObjectsDataSet.Controls;

    for (var i = 0; i < controls.length; i++) {
      control = controls[i];
      if (control.VisibleOnLoad == "N") {
	rule = this._visibilityRuleByName(control.VisibilityRuleName);
	rule.addControl(control);
      }
    }
  },

  _visibilityRuleByName: function(ruleName) {
    for (var ruleId in this.visibilityRules) {
      if (this.visibilityRules[ruleId].RuleName == ruleName)
	return this.visibilityRules[ruleId];
    }
    return null;
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
    html += this._emitControlsHtml();
    html += "</td>";
    html += "</tr>";
    return html;
  },

  emitRuleDescription: function() {
    var ruleHtml = "<span title=\"Id: " + this.RulesId + ", Name: " + this.RuleName + "\" class=\"simple-rule\">";
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

  _emitControlsHtml: function() {
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
	this.ControlName.isIncrementalMatch(searchTerm)) {
      return true;
    }
    else {
      return false;
    }
  }

};

function ComplexVisibilityRule(rule) {
  this.RuleName = rule.RulesMasterName;
  this.RulesId = rule.RulesMasterId;
  this.RulesCode = rule.RulesMasterCode;
  this.RulesDescription = rule.RulesMasterDescription;
  this.controls = new Array();
  this.simpleRules = new Array();
}

ComplexVisibilityRule.prototype = {

  addSimpleRule: function(simpleRule) {
    this.simpleRules[simpleRule.RulesId.toString()] = simpleRule;
  },

  addControl: function(control) {
    this.controls.push(control);
  },

  emitHtml: function() {
    var html = "<tr class=\"ui-widget-content\">";
    html += "<td>" + this.RuleName + "</td>";
    html += "<td colspan=\"3\" class=\"rule-description\" id=\"" + this.RuleName + "\">" + this.emitRuleDescription() + "</td>";
    html += "<td>";
    html += this._emitControlsHtml();
    html += "</td>";
    html += "</tr>";
    return html;
  },

  emitRuleDescription: function() {
    var parser = new ComplexRuleParser(this.RulesCode);
    var complexRuleDescription = parser.parse();
    complexRuleDescription = complexRuleDescription.replace("&&", " AND ", "g"); // "g" means replace globally
    complexRuleDescription = complexRuleDescription.replace("||", " OR ", "g");
    return complexRuleDescription;
  },

  _emitControlsHtml: function() {
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
	this._childMatchesSearchTerm(searchTerm)) {
      return true;
    }
    else {
      return false;
    }
  },

  _childMatchesSearchTerm: function(searchTerm) {
    // TODO: this.simpleRules isn't being initialized at the moment, need to use
    // ComplexRuleParser to get a list of children for the Complex Rule.
    if (this.simpleRules.length == 0) {
      return false;
    }
    else {
      for (var simpleRuleId in this.simpleRules) {
	if (this.simpleRules[simpleRuleId].matchesSearchTerm(searchTerm)) {
	  return true;
	}
      }
    }
    return false;
  }

};

function ComplexRuleParser(complexRuleDescription) {
  // Tokens are: "(", ")", "||", and "&&"
  this.TOKEN_REGEXP = new RegExp("^(\\(|\\)|\\|\\||&&)");
  this.ruleDescription = complexRuleDescription;
  this.expandedDescription = "";
  this.pos = 0;
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
	simpleRuleId = "";
      }
    }

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
    $("#tabs-list").prepend("<li><a href=\"#" + page.id + "\">" + page.name + "</a></li>");
    $("#visibility-rules").before("<div id=\"" + page.id + "\" class=\"" + ACTIVITY_PAGE_CLASS + "\">" + pageHtml + "</div>");
    //this._addLiveSearchToTab(page.id);
  },

  _renderPage: function(page) {
    var html = "<table>";
    html += "<thead><tr><th>Name</th><th>Visibility</th></tr></thead>";
    html += "<tbody>";

    var table;
    for (var childId in page.children)
      html += page.children[childId].render();

    html += "</tbody>";
    html += "</table>";

    return html;
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

    var visibilityRule = ACTIVITY_DATA._visibilityRuleByName(this.visibilityRuleName);
    html = "<tr>";
    html += "<td>" + this.name + "</td>";

    if (visibilityRule == null)
      html += "<td></td>";
    else
      html += "<td title=\"" + visibilityRule.RuleName + "\">" + visibilityRule.emitRuleDescription() + "</td>";

    html += "</tr>";

    return html;
  },

  matchesSearchTerm: function(searchTerm) {
    if (this.id == searchTerm ||
	this.name == searchTerm ||
	this.visibilityRuleName == searchTerm ||
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