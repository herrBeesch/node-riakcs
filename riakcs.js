// --------------------------------------------------------------------------------------------------------------------
//
// riakcs.js - the base class for all RiakCS
// by Andreas Beuge <andreasbeuge@me.com>
//
// License: http://opensource.org/licenses/MIT
//
// --------------------------------------------------------------------------------------------------------------------
// requires

var util = require("util");
var crypto = require('crypto');

// dependencies
var _ = require('underscore');
var xml2js = require('xml2js');

// our own library
var esc = require('./esc');
var awssum = require ("./awssum");

// --------------------------------------------------------------------------------------------------------------------
// constants

var MARK = 'riakcs: ';

// regions
var STORAGE = 'storage';
var DEFAULT = '';

var Region = {
    STORAGE : true,
    DEFAULT : true,
};

// create our XML parser
var parser = new xml2js.Parser({ normalize : false, trim : false, explicitRoot : true });

// --------------------------------------------------------------------------------------------------------------------
// constructor

var RiakCS = function(opts) {
    var self = this;
    var accessKeyId, secretAccessKey, awsAccountId, region, hostname;

    // call the superclass for initialisation
    RiakCS.super_.call(this, opts);

    // check that we have each of these values
    if ( ! opts.accessKeyId ) {
        throw MARK + 'accessKeyID is required';
    }
    if ( ! opts.secretAccessKey ) {
        throw MARK + 'secretAccessKey is required';
    }
    if ( ! opts.region ) {
        throw MARK + 'region is required';
    }
    if ( ! opts.hostname ) {
        throw MARK + 'hostname is required';
    }

    // set the local vars so the functions below can close over them
    accessKeyId         = opts.accessKeyId;
    secretAccessKey     = opts.secretAccessKey;
    region              = opts.region;
    hostname            = opts.hostname;
    if ( opts.awsAccountId ) {
        awsAccountId = opts.awsAccountId;
    }

    self.setAccessKeyId     = function(newStr) { accessKeyId = newStr; };
    self.setSecretAccessKey = function(newStr) { secretAccessKey = newStr; };
    self.setAwsAccountId    = function(newStr) { awsAccountId = newStr; };

    self.accessKeyId     = function() { return accessKeyId;     };
    self.secretAccessKey = function() { return secretAccessKey; };
    self.awsAccountId    = function() { return awsAccountId;    };
    self.region          = function() { return region;          };
    self.hostname        = function() { return hostname;        };
    
    return self;
};

// inherit from AwsSum
util.inherits(RiakCS, awssum.AwsSum);


// --------------------------------------------------------------------------------------------------------------------
// functions to be overriden by inheriting class

// see ../awssum.js for more details

RiakCS.prototype.extractBody = function() {
    return 'xml';
};

RiakCS.prototype.protocol = function() {
    return 'http';
};

RiakCS.prototype.addCommonOptions = function(options) {
    var self = this;

    // get the date in UTC : %Y-%m-%dT%H:%M:%SZ
    var date = (new Date()).toISOString();

    // add in the common params
    options.params.push({ 'name' : 'AWSAccessKeyId', 'value' : self.accessKeyId() });
    options.params.push({ 'name' : 'SignatureVersion', 'value' : self.signatureVersion() });
    options.params.push({ 'name' : 'SignatureMethod', 'value' : self.signatureMethod() });
    options.params.push({ 'name' : 'Timestamp', 'value' : date });
    options.params.push({ 'name' : 'Version', 'value' : self.version() });
    options.params.push({ 'name' : 'Hostname', 'value' : self.hostname });
    
    // make the strToSign, create the signature and sign it
    var strToSign = self.strToSign(options);
    var signature = self.signature(strToSign);
    self.addSignature(options, signature);
};

// --------------------------------------------------------------------------------------------------------------------
// functions to be overriden by inheriting (RiakCS) class

// function version()              -> string (the version of this service)
// function signatureVersion()     -> string (the signature version used)
// function signatureMethod()      -> string (the signature method used)
// function strToSign(options)     -> string (the string that needs to be signed)
// function signature(strToSign)   -> string (the signature itself)
// function addSignature(options, signature) -> side effect, adds the signature to the 'options'

// RiakCS.prototype.version // no default

RiakCS.prototype.signatureVersion = function() {
    return 2;
};

RiakCS.prototype.signatureMethod = function() {
    return 'HmacSHA256';
};

RiakCS.prototype.strToSign = function(options) {
    var self = this;

    // create the strToSign for this request
    var strToSign = options.method + "\n" + options.host.toLowerCase() + "\n" + options.path + "\n";

    // now add on all of the params (after being sorted)
    var pvPairs = _(options.params)
        .chain()
        .sortBy(function(p) { return p.name; })
        .map(function(v, i) { return '' + esc(v.name) + '=' + esc(v.value); })
        .join('&')
        .value()
    ;
    strToSign += pvPairs;

    // console.log('StrToSign:', strToSign);

    return strToSign;
};

RiakCS.prototype.signature = function(strToSign) {
    var self = this;

    // sign the request string
    var signature = crypto
        .createHmac('sha256', self.secretAccessKey())
        .update(strToSign)
        .digest('base64');

    // console.log('Signature :', signature);

    return signature;
};

RiakCS.prototype.addSignature = function(options, signature) {
    options.params.push({ 'name' : 'Signature', 'value' : signature });
};

// --------------------------------------------------------------------------------------------------------------------
// exports

// constants
exports.STORAGE = STORAGE;
exports.DEFAULT = DEFAULT;

// object constructor
exports.RiakCS = RiakCS;

// --------------------------------------------------------------------------------------------------------------------
