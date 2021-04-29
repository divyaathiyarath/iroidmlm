const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const sensorSchema = new Schema({
  uid: {
    type: String,
    required: true,
  },
  active: {
    type: Boolean,
    default: true,
  },
  delete_status: {
    type: Schema.Types.Boolean,
    default: false,
  },
  deleted_at: {
    type: Schema.Types.Date,
  },
});

module.exports = sensors = mongoose.model("sensors", sensorSchema);
