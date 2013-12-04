// --------------------------------------------------------------------------------------------------------------------
//
// riakcs.js - the base class for all RiakCS transactions
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
var request = require('request');
// our own library
var esc = require('./esc');


// --------------------------------------------------------------------------------------------------------------------
// constants

var MARK = 'riakcs: ';

var debug = false;

// create our XML parser
var parser = new xml2js.Parser({ normalize : false, trim : false, explicitRoot : true });

var userAgent = 'NodeRiakCs';


// --------------------------------------------------------------------------------------------------------------------
// constructor

var RiakCS = function(opts) {
    var self = this;
    var accessKeyId, secretAccessKey, awsAccountId, protocol, hostname;

    // check that we have each of these values
    if ( ! opts.accessKeyId ) {
        throw MARK + 'accessKeyID is required';
    }
    if ( ! opts.secretAccessKey ) {
        throw MARK + 'secretAccessKey is required';
    }
    if ( ! opts.hostname ) {
        throw MARK + 'hostname is required';
    }
    if ( ! opts.protocol ) {
        throw MARK + 'protocol is required';
    }
    
    // set the local vars so the functions below can close over them
    accessKeyId         = opts.accessKeyId;
    secretAccessKey     = opts.secretAccessKey;
    hostname            = opts.hostname;
    protocol            = opts.protocol;
    proxy               = opts.proxy;

    self.setAccessKeyId     = function(newStr) { accessKeyId = newStr; };
    self.setSecretAccessKey = function(newStr) { secretAccessKey = newStr; };

    self.accessKeyId     = function() { return accessKeyId;     };
    self.secretAccessKey = function() { return secretAccessKey; };
    self.hostname        = function() { return hostname;        };
    self.protocol        = function() { return protocol;        };
    self.proxy           = function() { return proxy;        };
    
    if ( typeof opts.agent !== 'undefined' ) {
        self._agent = opts.agent;
    }
    
    return self;
};

// --------------------------------------------------------------------------------------------------------------------
// functions to be overriden by inheriting class

RiakCS.prototype.agent = function() {
    return this._agent;
};

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
    options.params.push({ 'name' : 'Protocol', 'value' : self.protocol });
    options.params.push({ 'name' : 'Version', 'value' : self.version() });
    options.params.push({ 'name' : 'Hostname', 'value' : self.hostname });
    
    // make the strToSign, create the signature and sign it
    var strToSign = self.strToSign(options);
    var signature = self.signature(strToSign);
    self.addSignature(options, signature);
};



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


RiakCS.prototype.path = function() {
    return '/';
};

RiakCS.prototype.addExtras = function() { };

RiakCS.prototype.addCommonOptions = function(options, args) { };

RiakCS.prototype.statusCode = function(options) {
    return 200;
};

RiakCS.prototype.extractBody = function(options) {
    return 'none';
};

RiakCS.prototype.extractBodyWhenError = function(options) {
    // set default to be undefined, so it'll be defaulted to the extractBody value in the response processing
    return undefined;
};

RiakCS.prototype.extractHeaders = function() {
    // default to extracting _all_ of the headers
    return true;
};


// ---- configured functions execution   ------------------------------------------------------------------------------

// curry the send function for this operation

function makeOperation(operation) {
    return function(args, opts, callback) {
        var self = this;

        if ( arguments.length === 0 ) {
            // defined as fn()
            args = {};
            opts = {};
            callback = noop;
        }
        else if ( arguments.length === 1 ) {
            // defined as fn(callback)
            callback = args;
            args = {};
            opts = {};
        }
        else if ( arguments.length === 2 ) {
            // defined as fn(args, callback)
            callback = opts;
            opts = {};
        }
        else if ( arguments.length === 3 ) {
            // do nothing, we have everything, defined as fn(args, opts, callback)
        }

        self.send(operation, args, opts, callback);
    };
}


function setHeader(header, name, value) {
    header[name] = value;
}

function setHeaderIfDefined(header, name, value) {
    if ( ! _.isUndefined(value) ) {
        header[name] = value;
    }
}


function decodeWwwFormUrlEncoded(body) {
    var form = {};
    // turn the buffer into a string before splitting
    body.toString('utf8').split('&').forEach(function(v, i) {
        var keyValueArray = v.split('=');
        form[keyValueArray[0]] = unescape(keyValueArray[1]);
    });
    return form;
}

function isStatusCodeOk(statusCode, received) {
    if ( _.isObject(statusCode) && statusCode[received] ) {
        return true;
    }

    if ( statusCode === received ) {
        return true;
    }

    return false;
}


RiakCS.prototype.send = function(operation, args, opts, callback) {
    var self = this;

    var argName, spec; // for iterations later in the function

    // extend the args with the defaults for this operation (e.g. Action, Target)
    if ( operation.defaults ) {
        for (var key in operation.defaults) {
            if ( typeof operation.defaults[key] === 'function' ) {
                args[key] = operation.defaults[key].apply(self, [ operation, args ]);
            }
            else {
                // the default, just copy it over (even if undefined)
                args[key] = operation.defaults[key];
            }
        }
    }

    // check that we have all of the args we expected for this operation
    for ( argName in operation.args ) {
        spec = operation.args[argName];

        // see if this is required (and check it exists, even if it is undefined)
        if ( spec.required && !(argName in args) ) {
            callback({ Code : 'RiakCSCheck', Message : 'Provide a ' + argName });
            return;
        }
    }

    // ---

    // BUILD ALL OF THE OPTIONS

    // build all of the request options
    var options = {};

    // ---

    // REQUEST STUFF
    if ( operation.method ) {
        if ( typeof operation.method === 'string' ) {
            options.method = operation.method;
        }
        else if ( typeof operation.method === 'function' ) {
            options.method = operation.method.apply(self, [ options, args ]);
        }
        else {
            // since this is a program error, we're gonna throw this one
            throw 'Unknown operation.method : ' + typeof operation.method;
        }
    }

    // ---

    // build the protocol
    options.protocol = self.protocol();
    if ( operation.protocol ) {
        if ( typeof operation.protocol === 'string' ) {
            options.protocol = operation.protocol;
        }
        else if ( typeof operation.protocol === 'function' ) {
            options.protocol = operation.protocol.apply(self, [ options, args ]);
        }
        else {
            // since this is a program error, we're gonna throw this one
            throw 'Unknown operation.protocol : ' + typeof operation.protocol;
        }
    }


    // ---

    // build the host
    if ( operation.host ) {
        if ( typeof operation.host === 'function' ) {
            options.host = operation.host.apply(self, [ options, args ]);
        }
        else if ( typeof operation.host === 'string' ) {
            options.host = operation.host;
        }
        else {
            // since this is a program error, we're gonna throw this one
            throw 'Unknown operation.host : ' + typeof operation.host;
        }
    }

    // ---

    // build the hostname
    options.hostname = self.hostname(args);
    if ( operation.hostanme ) {
        if ( typeof operation.hostname === 'function' ) {
            options.hostname = operation.hostname.apply(self, [ options, args ]);
        }
        else if ( typeof operation.hostname === 'string' ) {
            options.hostname = operation.hostname;
        }
        else {
            // since this is a program error, we're gonna throw this one
            throw 'Unknown operation.hostname : ' + typeof operation.hostname;
        }
    }

    // ---

    // build the path
    options.path = '';
    if ( operation.path ) {
        if ( typeof operation.path === 'function' ) {
            options.path = operation.path.apply(self, [ options, args ]);
        }
        else if ( typeof operation.path === 'string' ) {
            options.path = operation.path;
        }
        else {
            // since this is a program error, we're gonna throw this one
            throw 'Unknown operation.path : ' + typeof operation.path;
        }
    }
    // ---

    // build the aws stuff
    if (args.BucketName){
      options.aws = {
        key: self.accessKeyId(),
        secret: self.secretAccessKey(),
        bucket: args.BucketName
      };
    }
    else {      
      options.aws = {
        key: self.accessKeyId(),
        secret: self.secretAccessKey()
      };
    }
    
    
    // build all of the params and headers, and copy the body if user-supplied
    options.params = [];
    options.headers = {};
    options.forms = [];
    options.json = {};
    for ( argName in operation.args ) {
        spec = operation.args[argName];
        var name = spec.name || argName;

        // if this is a param type, add it there
        if ( spec.type === 'param' ) {
            addParamIfDefined( options.params, name, args[argName] );
        }
        else if ( spec.type === 'resource' ) {
            // for Amazon S3 .. things like /?acl, /?policy and /?logging
            addParam( options.params, name, undefined );
        }
        else if ( spec.type === 'param-array' ) {
            addParamArray( options.params, name, args[argName], spec.prefix );
        }
        else if ( spec.type === 'param-array-set' ) {
            addParamArraySet( options.params, spec.setName, name, args[argName] );
        }
        else if ( spec.type === 'param-2d-array' ) {
            addParam2dArray( options.params, spec.setName, name, args[argName] );
        }
        else if ( spec.type === 'param-2d-array-set' ) {
            addParam2dArraySet( options.params, spec.setName, spec.subsetName, name, args[argName] );
        }
        else if ( spec.type === 'param-array-of-objects' ) {
            addParamArrayOfObjects( options.params, spec.setName || name, args[argName] );
        }
        else if ( spec.type === 'param-data' ) {
            addParamData( options.params, spec.setName || name, args[argName], spec.prefix );
        }
        else if ( spec.type === 'param-json' ) {
            addParamJson( options.params, spec.setName || name, args[argName] );
        }
        else if ( spec.type === 'header' ) {
            setHeaderIfDefined( options.headers, name, args[argName] );
        }
        else if ( spec.type === 'header-base64' ) {
            if ( ! _.isUndefined(args[argName]) ) {
                setHeader( options.headers, name, (new Buffer(args[argName])).toString('base64') );
            }
        }
        else if ( spec.type === 'form' ) {
            addFormIfDefined( options.forms, name, args[argName] );
        }
        else if ( spec.type === 'form-array' ) {
            addParamArray( options.forms, name, args[argName], spec.prefix );
        }
        else if ( spec.type === 'form-base64' ) {
            if ( ! _.isUndefined(args[argName]) ) {
                addParam( options.forms, name, (new Buffer(args[argName])).toString('base64') );
            }
        }
        else if ( spec.type === 'json' ) {
            addJsonIfDefined( options.json, name, args[argName] );
        }
        else if ( spec.type === 'body' ) {
            // there should be just one of these
            options.body = args[argName];
        }
        else if ( spec.type === 'special' ) {
            // this will be dealt with specifically later on - all ok
        }
        else {
            // since this is a program error, we're gonna throw this one
            throw 'Unknown argument type : ' + spec.type;
        }
    }

    // ---

    // build the body from either options.form, options.json or using operation.body

    // !!!TODO!!!

    // build the body (if defined in the operation rather than as a required attribute)
    if ( operation.body ) {
        if ( typeof operation.body === 'string' ) {
            options.body = operation.body;
            setHeaderIfDefined( options.headers, 'Content-Length', Buffer.byteLength(options.body, 'utf8') );
        }
        else if ( typeof operation.body === 'function' ) {
            options.body = operation.body.apply(self, [ options, args ]);            
            setHeaderIfDefined( options.headers, 'Content-Length', Buffer.byteLength(options.body, 'utf8'));
        }
        else {
            // since this is a program error, we're gonna throw this one
            throw 'Unknown operation.body : ' + typeof operation.body;
        }
    }

    // ---

    // add anything extra into the request
    var addExtras = operation.addExtras || self.addExtras;
    if ( ! _.isArray(addExtras) ) {
        addExtras = [addExtras];
    }
    addExtras.forEach( function(extra) {
        if ( typeof extra === 'function' ) {
            extra.apply(self, [ options, args ]);
        }
        else {
            // since this is a program error, we're gonna throw this one
            throw 'Unknown addExtras : ' + typeof extra;
        }
    });

    // finally, add the common operations
    self.addCommonOptions(options, args);

    // ---

    // RESPONSE STUFF

    // get the status code we expect, either a number on the operation or the default for this service
    var statusCode = operation.statusCode || self.statusCode();
    // if this isn't a number or an object, it's an error
    if ( ! _.isNumber(statusCode) && ! _.isObject(statusCode) ) {
        // since this is a program error, we're gonna throw this one
        throw 'Unknown statusCode : ' + typeof statusCode;
    }

    // build which headers to extract
    var extractHeaders = operation.extractHeaders || self.extractHeaders();
    if ( typeof extractHeaders === 'string'
         || Array.isArray(extractHeaders)
         || _.isObject(extractHeaders)
         || _.isRegExp(extractHeaders)
         || _.isFunction(extractHeaders)
         || extractHeaders === true ) {
        // all ok
    }
    else {
        // since this is a program error, we're gonna throw this one
        throw 'Unknown extractHeaders : ' + typeof extractHeaders;
    }

    // build the extractBody stuff
    var extractBody = operation.extractBody || self.extractBody();
    if ( extractBody !== 'xml' &&
         extractBody !== 'json' &&
         extractBody !== 'blob' &&
         extractBody !== 'string' &&
         extractBody !== 'application/x-www-form-urlencoded' &&
         extractBody !== 'none' &&
         !_.isFunction(extractBody) ) {
        // since this is a program error, we're gonna throw this one
        throw 'Unknown extractBody : ' + typeof extractBody;
    }

    // build the extractBodyWhenError
    var extractBodyWhenError = operation.extractBodyWhenError || self.extractBodyWhenError();
    if ( ! extractBodyWhenError ) {
        // if nothing is defined, then default to the same as extractBody
        extractBodyWhenError = extractBody;
    }
    if ( extractBodyWhenError !== 'xml' &&
         extractBodyWhenError !== 'json' &&
         extractBodyWhenError !== 'blob' &&
         extractBodyWhenError !== 'string' &&
         extractBodyWhenError !== 'application/x-www-form-urlencoded' &&
         extractBodyWhenError !== 'none' &&
         !_.isFunction(extractBodyWhenError) ) {
        // since this is a program error, we're gonna throw this one
        throw 'Unknown extractBodyWhenError : ' + typeof extractBodyWhenError;
    }

    // ---
    // and finally ... add our own User-Agent so RiakCS et al can help debug problems when they occur
    setHeader( options.headers, 'User-Agent', userAgent);

    // ---

    if ( debug ) {
        console.log('-------------------------------------------------------------------------------');
        console.log('Request:');
        console.log('- method         : ', options.method);
        console.log('- protocol       : ', options.protocol);
        console.log('- hostname       : ', options.hostname);
        console.log('- path           : ', options.path);
        console.log('- params         : ', options.params);
        console.log('- headers        : ', options.headers);
        console.log('- forms          : ', options.forms);
        console.log('- json           : ', options.json);
        console.log('- body           : ', options.body);
        console.log('Request:');
        console.log('- statusCode     :', statusCode);
        console.log('- extractHeaders :', extractHeaders);
        console.log('- extractBody :', extractBody);
        console.log('-------------------------------------------------------------------------------');
    }

    // now send the request
    self.request( options, function(err, res) {
        // an error with the request is an error full-stop
        if ( err ) {
            callback({
                Code : 'AwsSum-Request',
                Message : 'Something went wrong during the request',
                OriginalError : err
            }, null);
            // console.log('CALLBACK: failed due to error from request');
            return;
        }

        if ( debug ) {
            console.log('-------------------------------------------------------------------------------');
            console.log('Response:');
            console.log('- statusCode :', res.statusCode);
            console.log('- headers :', res.headers);
            console.log('- body :', res.body.toString());
            console.log('-------------------------------------------------------------------------------');
        }

        // save the whole result in here
        var result = {};

        // (1) add the status code first
        result.StatusCode = res.statusCode;

        // (2) add some headers into the result
        if ( extractHeaders ) {
            // this should be removed in favour of a regex option
            if ( extractHeaders === 'x-amz' ) {
                result.Headers = {};
                _.each(res.headers, function(val, hdr) {
                    if ( hdr.match(/^x-amz-/) ) {
                        // ToDo: it'd be nice if we convert things like:
                        // x-amz-request-id             -> RequestId
                        // x-amz-id-2                   -> Id2
                        // x-amz-server-side-encryption -> ServerSideEncryption
                        // x-amz-version-id             -> VersionId
                        result.Headers[hdr] = val;
                    }
                });
            }
            else if ( _.isRegExp(extractHeaders) ) {
                result.Headers = {};
                _.each(res.headers, function(val, hdr) {
                    if ( hdr.match(extractHeaders) ) {
                        result.Headers[hdr] = val;
                    }
                });
            }
            else if ( Array.isArray(extractHeaders) ) {
                // just return the headers that are in this list
                result.Headers = {};
                extractHeaders.forEach(function(v) {
                    result.Headers[v] = res.headers[v];
                });
            }
            else if ( _.isObject(extractHeaders) ) {
                // just return the headers that are in this list
                result.Headers = {};
                _.each(extractHeaders, function(v, k) {
                    result.Headers[k] = res.headers[k];
                });
            }
            else if ( _.isFunction(extractHeaders) ) {
                // this should return a hash of headers
                result.Headers = extractHeaders.apply(self, [ res ]);
            }
            else if ( extractHeaders === true ) {
                // extract _all_ headers
                result.Headers = res.headers;
            }
        } // else, don't extract any headers

        // (3) we may extract the body differently depending on the status code

        // see if this is not a valid statusCode
        if ( ! isStatusCodeOk(statusCode, res.statusCode) ) {
            extractBody = extractBodyWhenError;
        }

        // now extract the body

        // create the result and parse various things into it
        if ( extractBody === 'xml') {
            // decode the returned XML
            var ok = true;
            if (res.body){
            
              // Note: parseString is synchronous (not async)
              parser.parseString(res.body.toString(), function (err, data) {
                  if ( err ) {
                      result.Code    = 'AwsSum-ParseXml';
                      result.Message = 'Something went wrong during the XML parsing';
                      result.Error   = err;
                      result.Body    = res.body.toString();
                  }
                  else {
                      result.Body = data;
                  }
              });
            }

            // see if the xml parsing worked
            if ( !result.Body ) {
                callback(result, null);
                return;
            }
        }
        else if ( extractBody === 'json' ) {
            // get the JSON (should this be in a try/catch?)
            result.Body = JSON.parse(res.body.toString());
        }
        else if ( extractBody === 'blob' ) {
            // just return the body
            result.Body = res.body;
        }
        else if ( extractBody === 'application/x-www-form-urlencoded' ) {
            // decode the body and return it
            result.Body = decodeWwwFormUrlEncoded(res.body);
        }
        else if ( extractBody === 'none' ) {
            // no body, so just set a blank one
            result.Body = '';
        }
        else if ( extractBody === 'string' ) {
            // convert the body to a string
            result.Body = res.body.toString();
        }
        else if ( typeof extractBody === 'function' ) {
            result.Body = extractBody.apply(self, [ res ]);
        }
        else {
            // shouldn't ever be here since extractBody is checked above
            throw new Error("Program Error: Shouldn't ever be here");
        }

        // now we're ready to finally call the callback!!! :D
        if ( ! isStatusCodeOk(statusCode, res.statusCode) ) {
            // this was an error
            // console.log('CALLBACK: failed due to incorrect statusCode');
            callback(result, null);
            return;
        }

        // everything so far looks fine, callback with the result
        // console.log('CALLBACK: success');
        callback(null, result);
    });
};

// just takes the standard options and calls back with the result (or error)
//
// * options.method
// * options.path
// * options.params
// * options.headers
// * options.forms
// * options.json
// * options.body
RiakCS.prototype.request = function(options, callback) {
    var self = this;
    
    // since this can be called on both close and end, just do it once 
    callback = _.once(callback);
    var reqOptions = {
        headers : options.headers,
        method  : options.method,
        host    : options.host,
        proxy   : options.proxy,
        uri     : options.protocol + '://' + options.host + options.path,
        body    : options.body,        
        aws     : options.aws
    };

    
    // if we have any params, put them onto the path
    if ( options.params && options.params.length ) {
        reqOptions.path += '?' + self.stringifyQuery( options.params );
    }
    
    
    // if we have any JSON fields, stick it in the body
    if ( options.json && options.json.length) {
        reqOptions.body = JSON.stringify(options.json);        
    }
    
    // if the user has explicitly set for no agent
    if ( self.agent() === false ) {
        reqOptions.agent = false;
    }
    else if ( self.agent() !== undefined ) {
        // else, they have specifically set one
        reqOptions.agent = self.agent();
    }
    else {
        // no agent, use the default one
    }

    if ( debug ) {
        console.log('reqOptions = ', reqOptions);
    }
    
    request(reqOptions, function (error, response, body) {
        if(response){
          if (debug){
            console.log("Status from riakCS:")
            console.log(response.statusCode);
            console.log("Response from riakCS:")
            console.log(response.body);            
          }
          callback(null, response);
        } else {
          if (debug){            
            console.log("Error from riakCS:")
            console.log(error);
          }
          callback(error, null);
        }
      }
    )
};

// do our own strigify query, since querystring.stringify doesn't do what we want (for AWS and others)
RiakCS.prototype.stringifyQuery = function(params) {
    var self = this;
    // console.log('Params :', params);
    var query = _(params)
        .chain()
        .map(function(v, i) {
            return _.isUndefined(v.value) ?
                esc(v.name)
                : esc(v.name) + '=' + esc(v.value)
                ;
        })
        .join('&')
        .value()
    ;
    // console.log('Query :', query);
    return query;
};


// --------------------------------------------------------------------------------------------------------------------

function load(path) {
    // since NodeJS caches requires, we won't cache them here
    return require('./' + path);
}


// constants

// object constructor
exports.makeOperation = makeOperation;
exports.load = load;
exports.RiakCS = RiakCS;

// --------------------------------------------------------------------------------------------------------------------
