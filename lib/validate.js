/**
 * JSONSchema Validator - Validates JavaScript objects using JSON Schemas
 *	(http://www.json.com/json-schema-proposal/)
 *
 * Copyright (c) 2007 Kris Zyp SitePen (www.sitepen.com)
 * Licensed under the MIT (MIT-LICENSE.txt) license.
To use the validator call the validate function with an instance object and an optional schema object.
If a schema is provided, it will be used to validate. If the instance object refers to a schema (self-validating),
that schema will be used to validate and the schema parameter is not necessary (if both exist,
both validations will occur).
The validate method will return an array of validation errors. If there are no errors, then an
empty list will be returned. A validation error will have two properties:
"property" which indicates which property had the error
"message" which indicates what the error was
 */
({define:typeof define!="undefined"?define:function(deps, factory){module.exports = factory();}}).
define([], function(){
var exports = validate;
// setup primitive classes to be JSON Schema types
String.type = "string";
Boolean.type = "boolean";
Number.type = "number";
exports.Integer = {type:"integer"};
Object.type = "object";
Array.type = "array";
Date.type = "date";
exports.validate = validate;
function validate(/*Any*/instance,/*Object*/schema) {
		// Summary:
		//		To use the validator call JSONSchema.validate with an instance object and an optional schema object.
		// 		If a schema is provided, it will be used to validate. If the instance object refers to a schema (self-validating),
		// 		that schema will be used to validate and the schema parameter is not necessary (if both exist,
		// 		both validations will occur).
		// 		The validate method will return an object with two properties:
		// 			valid: A boolean indicating if the instance is valid by the schema
		// 			errors: An array of validation errors. If there are no errors, then an
		// 					empty list will be returned. A validation error will have two properties:
		// 						property: which indicates which property had the error
		// 						message: which indicates what the error was
		//
		return validate(instance, schema, {changing: false});//, coerce: false, existingOnly: false});
	};
exports.checkPropertyChange = function(/*Any*/value,/*Object*/schema, /*String*/property) {
		// Summary:
		// 		The checkPropertyChange method will check to see if an value can legally be in property with the given schema
		// 		This is slightly different than the validate method in that it will fail if the schema is readonly and it will
		// 		not check for self-validation, it is assumed that the passed in value is already internally valid.
		// 		The checkPropertyChange method will return the same object type as validate, see JSONSchema.validate for
		// 		information.
		//
		return validate(value, schema, {changing: property || "property"});
	};
var validate = exports._validate = function(/*Any*/instance,/*Object*/schema,/*Object*/options) {

	if (!options) options = {};
	var _changing = options.changing;

	var errors = [];
	// validate a value against a property definition
	function checkProp(value, schema, path,i){

		var l;
		path += path ? typeof i == 'number' ? '[' + i + ']' : typeof i == 'undefined' ? '' : '.' + i : i;
		function addError(message){
			errors.push({property:path,message:message});
		}

		if((typeof schema != 'object' || schema instanceof Array) && (path || typeof schema != 'function') && !(schema && schema.type)){
			if(typeof schema == 'function'){
				if(!(value instanceof schema)){
					addError("type");
				}
			}else if(schema){
				addError("invalid");
			}
			return null;
		}
		if(_changing && schema.readonly){
			addError("readonly");
		}
		if(schema['extends']){ // if it extends another schema, it must pass that schema as well
			checkProp(value,schema['extends'],path,i);
		}
		// validate a value against a type definition
		function checkType(type,value){
			if(type){
				if(typeof type == 'string' && type != 'any' &&
						(type == 'null' ? value !== null : typeof value != type) &&
						!(value instanceof Array && type == 'array') &&
						!(value instanceof Date && type == 'date') &&
						!(type == 'integer' && value%1===0)){
					return [{property:path,message:"type"}];
				}
				if(type instanceof Array){
					var unionErrors=[];
					for(var j = 0; j < type.length; j++){ // a union type
						if(!(unionErrors=checkType(type[j],value)).length){
							break;
						}
					}
					if(unionErrors.length){
						return unionErrors;
					}
				}else if(typeof type == 'object'){
					var priorErrors = errors;
					errors = [];
					checkProp(value,type,path);
					var theseErrors = errors;
					errors = priorErrors;
					return theseErrors;
				}
			}
			return [];
		}
		if(value === undefined){
			if((!schema.optional || typeof schema.optional == 'object' && !schema.optional[options.flavor]) && !schema.get){
				addError("required");
			}
		}else{
			errors = errors.concat(checkType(schema.type,value));
			if(schema.disallow && !checkType(schema.disallow,value).length){
				addError("disallowed");
			}
			if(value !== null){
				if(value instanceof Array){
					if(schema.items){
						var itemsIsArray = schema.items instanceof Array;
						var propDef = schema.items;
						for (i = 0, l = value.length; i < l; i += 1) {
							if (itemsIsArray)
								propDef = schema.items[i];
							if (options.coerce)
								value[i] = options.coerce(value[i], propDef);
							errors.concat(checkProp(value[i],propDef,path,i));
						}
					}
					if(schema.minItems && value.length < schema.minItems){
						addError("minItems");
					}
					if(schema.maxItems && value.length > schema.maxItems){
						addError("maxItems");
					}
				}else if(schema.properties || schema.additionalProperties){
					errors.concat(checkObj(value, schema.properties, path, schema.additionalProperties));
				}
				if(schema.pattern && typeof value == 'string' && !value.match(schema.pattern)){
					addError("pattern");
				}
				if(schema.maxLength && typeof value == 'string' && value.length > schema.maxLength){
					addError("maxLength");
				}
				if(schema.minLength && typeof value == 'string' && value.length < schema.minLength){
					addError("minLength");
				}
				if(typeof schema.minimum !== undefined && typeof value == typeof schema.minimum &&
						schema.minimum > value){
					addError("minimum");
				}
				if(typeof schema.maximum !== undefined && typeof value == typeof schema.maximum &&
						schema.maximum < value){
					addError("maximum");
				}
				if(schema['enum']){
					var enumer = schema['enum'];
					if (typeof enumer == 'function') enumer = enumer();
					// TODO: if enumer.then --> when(enumer, ...)
					l = enumer.length;
					var found;
					for(var j = 0; j < l; j++){
						if(enumer[j]===value){
							found=1;
							break;
						}
					}
					if(!found){
						addError("enum");
					}
				}
				if(typeof schema.maxDecimal == 'number' &&
					(value.toString().match(new RegExp("\\.[0-9]{" + (schema.maxDecimal + 1) + ",}")))){
					addError("digits");
				}
			}
		}
		return null;
	}
	// validate an object against a schema
	function checkObj(instance,objTypeDef,path,additionalProp){

		if(typeof objTypeDef =='object'){
			if(typeof instance != 'object' || instance instanceof Array){
				errors.push({property:path,message:"type"});
			}

			for(var i in objTypeDef){
				if(objTypeDef.hasOwnProperty(i)){
					var value = instance[i];
					// skip _not_ specified properties
					if (value === undefined && options.existingOnly) continue;
					var propDef = objTypeDef[i];
					// veto readonly props
					if (options.vetoReadOnly && (propDef.readonly === true || typeof propDef.readonly == 'object' && propDef.readonly[options.flavor])) {
						delete instance[i];
						continue;
					}
					// set default
					if(value === undefined && propDef["default"]){
						value = instance[i] = propDef["default"];
					}
					if(options.coerce && i in instance){
						value = instance[i] = options.coerce(value, propDef);
					}
					checkProp(value,propDef,path,i);
				}
			}
		}
		for(i in instance){
			if(instance.hasOwnProperty(i) && objTypeDef && !objTypeDef[i] && (additionalProp===false || options.removeAdditionalProps)){
				if (options.removeAdditionalProps) {
					delete instance[i];
					continue;
				} else {
					errors.push({property:path,message:"unspecifed"});
				}
			}
			var requires = objTypeDef && objTypeDef[i] && objTypeDef[i].requires;
			if(requires && !(requires in instance)){
				errors.push({property:path,message:"requires"});
			}
			value = instance[i];
			if(additionalProp && (!(objTypeDef && typeof objTypeDef == 'object') || !(i in objTypeDef))){
				if(options.coerce){
					value = instance[i] = options.coerce(value, additionalProp);
				}
				checkProp(value,additionalProp,path,i);
			}
			if(!_changing && value && value.$schema){
				errors = errors.concat(checkProp(value,value.$schema,path,i));
			}
		}
		return errors;
	}
	if(schema){
		checkProp(instance,schema,'',_changing || '');
	}
	if(!_changing && instance && instance.$schema){
		checkProp(instance,instance.$schema,'','');
	}
	return {valid:!errors.length,errors:errors};
};
exports.mustBeValid = function(result){
	//	summary:
	//		This checks to ensure that the result is valid and will throw an appropriate error message if it is not
	// result: the result returned from checkPropertyChange or validate
	if(!result.valid){
		throw new TypeError(JSON.stringify(result.errors));
	}
};

/*
 * if we'd rely on underscore (U)
 */
/*
exports.coerce = function(instance, schema) {
	var date, t;
	t = schema.type;
	if (t === 'string') {
		instance = instance != null ? ''+instance : '';
	} else if (t === 'number' || t === 'integer') {
		if (!U.isNaN(instance)) {
			instance = +instance;
			if (t === 'integer') {
				instance = Math.floor(instance);
			}
		}
	} else if (t === 'boolean') {
		instance = instance === 'false' ? false : !!instance;
	} else if (t === 'null') {
		instance = null;
	} else if (t === 'object') {} else if (t === 'array') {
		instance = U.toArray(instance);
	} else if (t === 'date') {
		date = new Date(instance);
		if (!U.isNaN(date.getTime())) {
			instance = date;
		}
	}
	return instance;
};
exports.validateCoerce = function(instance, schema) {
	return validate(instance, schema, {
		coerce: exports.coerce
	});
};
exports.validatePart = function(instance, schema) {
	return validate(instance, schema, {
		existingOnly: true,
		coerce: exports.coerce
	});
};
exports.validateFilter = function(instance, schema) {
	return validate(instance, schema, {
		removeAdditionalProps: true,
		coerce: exports.coerce
	});
};
*/

return exports;
});
