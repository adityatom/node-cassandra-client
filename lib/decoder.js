
/** [en|de]coder for cassandra types. */

var console = require('console');
var BigInteger = require('./bigint').BigInteger;

// after this point all precision bets are off.  the carriage becomes a pumpkin and you will lose your glass slipper.
var south = 9007199254740992;

// exported to expose in tests.
/** convert an 8 byte string to a signed long */
bytesToLong = module.exports.bytesToLong = function(bytes) {
  var num = 0;
  if (bytes.length != 8) {
    throw new Error('Longs are exactly 8 bytes, not ' + bytes.length);
  }
  
  // see if any bits (except the sign bit) are on in bits 53-63.  If so, convert to a bigint.
  if ((bytes.charCodeAt(0) && 127) > 0 || ((bytes.charCodeAt(1) && 224) > 0)) {
    return bytesToInt(bytes);  
  } else {
    for (var i = 0; i < bytes.length; i++) {
      num |= bytes.charCodeAt(i) << ((7 - i) * 8);
    }
  }
  
  return num;
};

bytesToInt = module.exports.bytesToInt = function(bytes) {
  // convert bytes (which is really a string) to a list of ints.
  var ints = [];
  for (var i = 0; i < bytes.length; i++) {
    ints[i] = bytes.charCodeAt(i); // how does this handle negative values (bytes that overflow 127)?
  }
  return new BigInteger(ints);  
};

// These are the cassandra types I'm currently dealing with.
var AbstractTypes = {
  LongType:     "org.apache.cassandra.db.marshal.LongType",  
  BytesType:    "org.apache.cassandra.db.marshal.BytesType",
  AsciiType:    "org.apache.cassandra.db.marshal.AsciiType",
  UTF8Type:     "org.apache.cassandra.db.marshal.UTF8Type",
  IntegerType:  "org.apache.cassandra.db.marshal.IntegerType"
  // todo: TimeUUID.
};

/** 
 * validators are a hash currently created in the Connection constructor. keys in the hash are: key, comparator, 
 * defaultValidator, specificValidator.  They all map to a value in AbstractTypes, except specificValidator which
 * hashes to another map that maps specific column names to their validators (specified in ColumnDef using Cassandra
 * parlance).
 * e.g.: {key: 'org.apache.cassandra.db.marshal.BytesType', 
 *        comparator: 'org.apache.cassandra.db.marshal.BytesType', 
 *        defaultValidator: 'org.apache.cassandra.db.marshal.BytesType', 
 *        specificValidator: {your_mother: 'org.apache.cassandra.db.marshal.BytesType',
 *                            my_mother: 'org.apache.cassandra.db.marshal.BytesType'}}
 * todo: maybe this is complicated enough that a class is required.
 */
Decoder = module.exports.Decoder = function(validators) {
  this.validators = validators;
};

/**
 * @param bytes raw bytes to decode.
 * @param which one of 'key', 'comparator', or 'value'.
 * @param column (optional) when which is 'value' this parameter specifies which column validator is to be used.
 */
Decoder.prototype.decode = function(bytes, which, column) {
  // determine which type we are converting to.
  var className = null;
  if (which == 'key') {
    className = this.validators.key;
  } else if (which == 'comparator') {
    className = this.validators.comparator;
  } else if (which == 'validator') {
    if (column && this.validators.specificValidators[column]) {
      className = this.validators.specificValidators[column];
    } else {
      className = this.validators.defaultValidator;
    }
  }
  if (!className) {
    console.log('using default for ' + which + ',' + column);
    className = AbstractTypes.BytesType;
  }
  
  // perform the conversion.
  if (className == AbstractTypes.LongType) {
    return bytesToLong(bytes);
  } else if (className == AbstractTypes.AsciiType || className == AbstractTypes.UTF8Type) {
    return bytes; // already as a string!
  } else if (className == AbstractTypes.BytesType) {
    return bytes;
  } else if (className == AbstractTypes.IntegerType) {
    return bytesToInt(bytes);
  } else {
    return bytes; 
  }
  // todo: IntegerType
};