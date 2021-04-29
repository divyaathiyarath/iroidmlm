const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;

const Driver = mongoose.model("drivers");
const Vehicle = mongoose.model("vehicles");
const Stock = mongoose.model("stocks");
const Setting = mongoose.model("settings");
const StockRequest = mongoose.model("stock_requests");
const Booking = mongoose.model("bookings");
const DriverLog = mongoose.model("driver_logs");
const DriverAlert = mongoose.model("driver_alerts");
const Product = mongoose.model("products");
const Suburb = mongoose.model("suburbs");
const Settings = mongoose.model("settings");
const JobNotification = mongoose.model("job_notifications");
const DriverNotification = mongoose.model("driver_notifications");
const StockTransfer = mongoose.model("stock_transfers");
const BookingSlot = mongoose.model("booking_slots");
const User = mongoose.model("users");
const _ = require("underscore");

const paginate = require("express-paginate");
const {
  ValidateDriverSignUpInputs,
  ValidateDriverResendOtpInputs,
  ValidateDriverVerifyOtp,
  ValidateDriverBasicDetails,
  ValidateDriverExtraDetails,
  ValidateDriverGenerateOTP,
  ValidateDriverLocationInput,
  ValidateDriverStartService,
  ValidateDriverAlerAdmin,
  ValidateDriverDeliverOrder,
  ValidateDriverFirebaseToken,
} = require("../../validators/driverValidator");

const { sendDriverFoodRequest } = require('../../jobs/notification')

const driverImageUpload = require("../../utils/uploads/driverImageUpload");
const driverDetailsUpload = require("../../utils/uploads/driverDetailsUpload");

const SendNotificaiton = require("../../jobs/driver_notification");
const SendUserNotification = require('../../jobs/user_notification')
const moment = require("moment");
const driver_notifications = require("../../models/driver_notifications");

const { trimMobile } = require("../../utils/general");
const { sendSms } = require("../../utils/sendsms");
const { sendAlertSms } = require("../../utils/alert_admin_sms");
const { send } = require("process");
//

exports.getComingShift = async () => {
  let offset = Math.abs(new Date().getTimezoneOffset());
  let today = moment().format("YYYY-MM-DD");
  let cur_date = moment().utcOffset(+offset).format("YYYY-MM-DD HH:mm");
  let current_slot = await Setting.aggregate([
    {
      $unwind: "$shift_times",
    },
    {
      $project: {
        _id: "$shift_times._id",
        name: "$shift_times.name",
        duration: "$shift_times.duration",
        time: "$shift_times.time",
      },
    },
    {
      $addFields: {
        start: { $toDate: { $concat: [today, " ", "$time"] } },
        end: { $toDate: { $concat: [today, " ", "$time"] } },
        current_date: cur_date,
        duration: {
          $add: ["$duration", 0.5]
        }
      },
    },
    {
      $addFields: {
        end: {
          $add: [
            "$end",
            {
              $multiply: ["$duration", 3600000],
            },
          ],
        },
        start: {
          $subtract: ["$start", {
            $multiply: [0.5, 3600000]
          }]
        },
        current_date: {
          $toDate: "$current_date",
        },
      },
    },
    {
      $match: {
        $expr: {
          $and: [
            { $gte: ["$current_date", "$start"] },
            { $lte: ["$current_date", "$end"] },
          ],
        },
      },
    },
    {
      $sort: {
        start: 1,
      },
    },
  ]);

  let setting = await Setting.aggregate([
    {
      $unwind: "$shift_times",
    },
    {
      $project: {
        _id: "$shift_times._id",
        name: "$shift_times.name",
        duration: "$shift_times.duration",
        time: "$shift_times.time",
      },
    },
    {
      $addFields: {
        start: { $toDate: { $concat: [today, " ", "$time"] } },
        end: { $toDate: { $concat: [today, " ", "$time"] } },
      },
    },
    {
      $addFields: {
        end: {
          $add: [
            "$end",
            {
              $multiply: ["$duration", 3600000],
            },
          ],
        },
      },
    },
    {
      $match: {
        $expr: {
          $and: [{ $gte: ["$start", new Date()] }],
        },
      },
    },
    {
      $sort: {
        start: 1,
      },
    },
  ]);

  let setting2 = await Setting.aggregate([
    {
      $unwind: "$shift_times",
    },
    {
      $project: {
        _id: "$shift_times._id",
        name: "$shift_times.name",
        duration: "$shift_times.duration",
        time: "$shift_times.time",
      },
    },
    {
      $addFields: {
        today: { $toDate: { $concat: [today, " ", "$time"] } },
      },
    },
    {
      $sort: {
        today: 1,
      },
    },
  ]);

  if (current_slot.length > 0) {
    return {
      coming_shift: current_slot[0]._id,
      shifts: setting2,
    };
  } else if (setting.length > 0) {
    return {
      coming_shift: setting[0]._id,
      shifts: setting2,
    };
  } else {
    return {
      coming_shift: null,
      shifts: setting2,
    };
  }
};

exports.refreshSlots = async (data) => {
  let { shift_id, driver_id } = data;
  let driver = await Driver.findOne({ _id: ObjectId(driver_id) });

  let start_date = new Date(moment().format('YYYY-MM-DD 00:00:000'))
  let end_date = new Date(moment().format('YYYY-MM-DD 23:59'))
  slots = await BookingSlot.aggregate([
    {
      $geoNear: {
        near: driver.location,
        key: "location",
        spherical: true,
        distanceField: "distance",
        distanceMultiplier: 0.001,
        query: {
          shift_id: ObjectId(shift_id),
          driver_id: ObjectId(driver_id),
        },
      },
    },
    {
      $match: {
        shift_id: ObjectId(shift_id),
        // date: new Date(moment().format("YYYY-MM-DD")),
        driver_id: ObjectId(driver_id),
        $and: [
          {
            date: {
              $gte: start_date
            }
          },
          {
            date: {
              $lte: end_date
            }
          }
        ]
      },
    },
  ]);

  slots.forEach(async (slot) => {
    let { _id, distance } = slot;
    if (_id && distance) {
      await BookingSlot.updateOne(
        {
          _id: ObjectId(_id),
        },
        {
          $set: {
            distance: parseFloat(distance),
          },
        }
      );
    }
  });
  return true;
  // return res.json({
  //   status:true,
  //   slots
  // })
};

exports.updateBookingOrder = async (data) => {
  let { driver_id } = data
  let start_date = new Date(moment().format('YYYY-MM-DD 00:00:000'))
  let end_date = new Date(moment().format('YYYY-MM-DD 23:59'))
  let slots = await BookingSlot.aggregate([
    {
      $match: {
        // date: new Date(moment().format('YYYY-MM-DD')),
        driver_id: ObjectId(driver_id),
        $and: [
          {
            date: {
              $gte: start_date
            }
          },
          {
            date: {
              $lte: end_date
            }
          }
        ]
      }
    },
    {
      $lookup: {
        from: 'bookings',
        let: {
          booking_id: "$booking_id"
        },
        pipeline: [
          {
            $match: {
              $expr: {
                $eq: ["$_id", "$$booking_id"]
              }
            }
          }
        ],
        as: "booking"
      }
    },
    {
      $addFields: {
        booking: {
          $arrayElemAt: ["$booking", 0]
        }
      }
    },
    {
      $project: {
        _id: 1,
        booking_id: 1,
        date: 1,
        shift_id: 1,
        driver_id: 1,
        booked_date: "$booking.created_at",
        curr_date: new Date(moment().format('YYYY-MM-DD hh:mm a'))
      }
    },
    {
      $addFields: {
        date_diff: {
          $divide: [
            {
              $subtract: ["$curr_date", "$booked_date"]
            }, 3600000
          ]
        }
      }
    },
    {
      $sort: {
        booked_date: 1
      }
    }
  ])

  slots.forEach(async (slot) => {
    let { _id, date_diff } = slot
    if (_id && date_diff) {
      if (date_diff > 0.45) {
        await BookingSlot.updateOne({
          _id
        }, {
          $inc: {
            order: 1
          }
        })
      }
    }
  })
  return true
}
// check email exists
exports.checkEmailExists = async (email, id) => {
  let query = {
    delete_status: false,
    email,
  };
  if (id != null) {
    query._id = {
      $ne: id,
    };
  }
  return await Driver.countDocuments(query);
};

// check mobile exists
exports.checkMobileExists = async (mobile, id) => {
  let query = {
    delete_status: false,
    mobile,
  };
  if (id != null) {
    query._id = {
      $ne: id,
    };
  }
  return await Driver.countDocuments(query);
};

exports.checkRegistrationNumberExists = async (registration_number, id) => {
  let query = {
    delete_status: false,
    registration_number,
  };
  if (id != null) {
    query._id = {
      $ne: id,
    };
  }
  return await Vehicle.countDocuments(query);
};

exports.checkLicenseNumberExists = async (license_number, id) => {
  let query = {
    delete_status: false,
    license_number,
  };
  if (id != null) {
    query._id = {
      $ne: id,
    };
  }
  return await Driver.countDocuments(query);
};

exports.signUp = async (req, res) => {
  try {
    await driverImageUpload(req, res);
  } catch (err) {
    console.log(err);
    return res.json({
      status: false,
      message: "Could not upload image",
    });
  }
  try {
    const { errors, isValid } = ValidateDriverSignUpInputs(req.body);
    if (!isValid) {
      return res.json({
        status: false,
        message: errors[0],
      });
    }
    let { name, email, mobile } = req.body;
    mobile = trimMobile(mobile);
    let { image } = req.files;
    if (await this.checkEmailExists(email, null)) {
      return res.json({
        status: false,
        message: "Email already registered with us",
      });
    }
    if (await this.checkMobileExists(mobile, null)) {
      return res.json({
        status: false,
        message: "Mobile number already registered with us",
      });
    }
    let otp = Math.floor(1000 + Math.random() * 9000);
    if (mobile == "9999000000" || mobile == "8939568878") {
      otp = 1111;
    }
    if (typeof image != "undefined" && image.length > 0) {
      image = image[0].destination + "/" + image[0].filename;
    } else {
      image = null;
    }
    let driver = new Driver({
      name,
      email,
      mobile,
      otp: otp,
      image,
      created_by: "ONLINE",
      created_at: Date.now()
    });
    await sendSms(mobile, otp);
    await driver.save();
    return res.json({
      status: true,
      message: "An OTP has been send to provided mobile number",
      otp,
    });
  } catch (err) {
    console.log(err);
    return res.json({
      status: false,
      message: "Sorry something went wrong",
    });
  }
};

exports.resendOtp = async (req, res) => {
  try {
    const { errors, isValid } = ValidateDriverResendOtpInputs(req.body);
    if (!isValid) {
      return res.json({
        status: false,
        message: errors[0],
      });
    }
    let { mobile } = req.body;
    mobile = trimMobile(mobile);
    let driver = await Driver.findOne({
      mobile,
      delete_status: false,
    });
    if (driver) {
      let otp = Math.floor(1000 + Math.random() * 9000);
      if (mobile == "9999000000" || mobile == "8939568878") {
        otp = 1111;
      }
      driver.otp = otp;
      await sendSms(mobile, otp);
      await driver.save();
      return res.json({
        status: true,
        message: "An OTP has been send to provided mobile number",
        otp,
      });
    } else {
      return res.json({
        status: false,
        message: "Mobile number is not registred with us",
      });
    }
  } catch (err) {
    console.log(err);
    return res.json({
      status: false,
      message: "Sorry something went wrong",
    });
  }
};

exports.verifyOtp = async (req, res) => {
  try {
    let { errors, isValid } = ValidateDriverVerifyOtp(req.body);
    if (!isValid) {
      return res.json({
        status: false,
        message: errors[0],
      });
    }
    let { mobile, otp } = req.body;
    mobile = trimMobile(mobile);
    let driver = await Driver.findOne({
      mobile,
      delete_status: false,
    });
    if (driver) {
      if (driver.otp == otp) {
        driver.otp = null;
        await driver.save();
        return res.json({
          status: true,
          message: "OTP verified successfully",
          data: driver.toAuthJSON(),
        });
      } else {
        return res.json({
          status: false,
          message: "OTP verification failed",
        });
      }
    } else {
      return res.json({
        status: false,
        message: "Mobile number is not registered with us",
      });
    }
  } catch (err) {
    console.log(err);
    return res.json({
      status: false,
      message: "Sorry something went wrong",
    });
  }
};

exports.basicDetails = async (req, res) => {
  try {
    let { errors, isValid } = ValidateDriverBasicDetails(req.body);
    if (!isValid) {
      return res.json({
        status: false,
        message: errors[0],
      });
    }
    let {
      address,
      age_confirm,
      has_car,
      registration_number,
      abn_number,
    } = req.body;
    let driver = await Driver.findOne({
      _id: req.payload._id,
    });
    if (
      await this.checkRegistrationNumberExists(
        registration_number,
        driver.vehicle_id
      )
    ) {
      return res.json({
        status: false,
        message: "Registration number is already exists",
      });
    }
    if (driver.vehicle_id) {
      vehicle = await Vehicle.findOne({
        _id: driver.vehicle_id,
      });
    } else {
      vehicle = new Vehicle();
      vehicle.driver_id = driver._id;
    }
    vehicle.registration_number = registration_number;
    saved_vehicle = await vehicle.save();
    await Driver.updateOne(
      {
        _id: req.payload._id,
      },
      {
        $set: {
          vehicle_id: saved_vehicle._id,
          address,
          age_confirm,
          has_car,
          profile_completed: false,
          abn_number,
        },
      }
    );
    return res.json({
      status: true,
      message: "Details has been saved",
    });
  } catch (err) {
    console.log(err);
    return res.json({
      status: false,
      message: "Sorry something went wrong",
    });
  }
};

exports.extraDetails = async (req, res) => {
  try {
    await driverDetailsUpload(req, res);
  } catch (err) {
    console.log(err.message);
    return res.json({
      status: false,
      message: "Could not upload file",
    });
  }
  try {
    let { errors, isValid } = ValidateDriverExtraDetails(req.body);
    if (!isValid) {
      return res.json({
        status: false,
        message: errors[0],
      });
    }
    let { license_expiry, insurance_validity, license_number } = req.body;
    let { license, police_clearance, insurance } = req.files;

    let driver = await Driver.findOne({
      _id: req.payload._id,
    });
    if (await this.checkLicenseNumberExists(license_number, driver._id)) {
      return res.json({
        status: false,
        message: "License number already existing",
      });
    }

    if (typeof insurance != "undefined" && insurance.length > 0) {
      insurance = insurance[0].destination + "/" + insurance[0].filename;
    }
    if (typeof police_clearance != "undefined" && police_clearance.length > 0) {
      police_clearance =
        police_clearance[0].destination + "/" + police_clearance[0].filename;
    }
    if (typeof license != "undefined" && license.length > 0) {
      driving_license = license[0].destination + "/" + license[0].filename;
    }

    driver.license_expiry = license_expiry;
    driver.driving_license = driving_license;
    driver.police_clearance = police_clearance;
    driver.license_number = license_number;
    driver.profile_completed = true;
    await driver.save();
    await Vehicle.updateOne(
      {
        _id: driver.vehicle_id,
      },
      {
        $set: {
          insurance_validity,
          insurance,
        },
      }
    );
    return res.json({
      status: true,
      message: "Registration completed successfully",
    });
  } catch (err) {
    console.log(err);
    return res.json({
      status: false,
      message: "Sorry something went wrong",
    });
  }
};

exports.profileStatus = async (req, res) => {
  try {
    let driver = await Driver.findOne({
      _id: req.payload._id,
    });
    if (driver.delete_status == true) {
      return res.json({
        status: false,
        message: "Your account has been deleted by admin",
      });
    }
    if (driver.is_rejected == true) {
      return res.json({
        status: true,
        // data: driver.admin_review,
        message: "Your account has been rejected",
        data: {
          profile_completed: driver.profile_completed,
          is_approved: driver.is_approved,
          is_rejected: driver.is_rejected,
          admin_review: driver.admin_review,
        },
      });
    }
    if (
      driver.is_rejected == false &&
      driver.is_approved == true &&
      driver.profile_completed == true
    ) {
      return res.json({
        status: true,
        message: "Your account has been approved",
        data: {
          profile_completed: driver.profile_completed,
          is_approved: driver.is_approved,
          is_rejected: driver.is_rejected,
          admin_review: driver.admin_review,
        },
      });
    }
    if (
      driver.is_rejected == false &&
      driver.is_approved == false &&
      driver.profile_completed == true
    ) {
      return res.json({
        status: true,
        message: "Waiting for admin approval",
        data: {
          profile_completed: driver.profile_completed,
          is_approved: driver.is_approved,
          is_rejected: driver.is_rejected,
          admin_review: driver.admin_review,
        },
      });
    }
  } catch (err) {
    console.log(err);
    return res.json({
      status: false,
      message: "Sorry something went wrong",
    });
  }
};

exports.registrationDetails = async (req, res) => {
  try {
    let driver = await Driver.findOne(
      {
        _id: req.payload._id,
        delete_status: false,
      },
      {
        name: 1,
        email: 1,
        mobile: 1,
        address: 1,
        image: 1,
        age_confirm: 1,
        has_car: 1,
        registration_number: 1,
        abn_number: 1,
        license_expiry: 1,
        insurance_validity: 1,
        license_number: 1,
        driving_license: 1,
        police_clearance: 1,
        insurance: 1,
        vehicle_id: 1,
      }
    ).populate({
      path: "vehicle_id",
    });
    if (driver) {
      let details = {
        name: driver.name,
        email: driver.email,
        mobile: driver.mobile,
        address: driver.address,
        image: driver.image,
        age_confirm: driver.age_confirm,
        has_car: driver.has_car,
        license_number: driver.license_number,
        police_clearance: driver.police_clearance,
        driving_license: driver.driving_license,
        license_expiry: driver.license_expiry,
        abn_number: driver.abn_number,
        registration_number: driver.vehicle_id.registration_number,
        insurance: driver.vehicle_id.insurance,
        insurance_validity: driver.vehicle_id.insurance_validity,
      };
      return res.json({
        status: true,
        data: details,
      });
    } else {
      return res.json({
        status: false,
        message: "Driver not found",
      });
    }
  } catch (err) {
    console.log(err);
    return res.json({
      status: false,
      message: "Sorry something went wrong",
    });
  }
};

exports.resubmitRegistration = async (req, res) => {
  try {
    await driverDetailsUpload(req, res);
  } catch (err) {
    console.log(err.message);
    return res.json({
      status: false,
      message: "Could not upload file",
    });
  }
  try {
    let { errors, isValid } = ValidateDriverBasicDetails(req.body);
    if (!isValid) {
      return res.json({
        status: false,
        message: errors[0],
      });
    }
    console.log(req.body);
    let {
      address,
      age_confirm,
      has_car,
      registration_number,
      abn_number,
      license_expiry,
      insurance_validity,
      license_number,
    } = req.body;
    let { license, police_clearance, insurance } = req.files;
    let driver = await Driver.findOne({
      _id: req.payload._id,
      delete_status: false,
    });
    if (driver) {
      if (
        await this.checkRegistrationNumberExists(
          registration_number,
          driver.vehicle_id
        )
      ) {
        return res.json({
          status: false,
          message: "Registration number is already exists",
        });
      }
      if (driver.vehicle_id) {
        vehicle = await Vehicle.findOne({
          _id: driver.vehicle_id,
        });
        if (typeof insurance != "undefined" && insurance.length > 0) {
          vehicle.insurance =
            insurance[0].destination + "/" + insurance[0].filename;
        }
      } else {
        vehicle = new Vehicle();
        vehicle.driver_id = driver._id;
      }
      vehicle.registration_number = registration_number;
      vehicle.insurance_validity = insurance_validity;
      saved_vehicle = await vehicle.save();
      (driver.address = address),
        (driver.age_confirm = age_confirm),
        (driver.has_car = has_car),
        (driver.abn_number = abn_number),
        (profile_completed = true);
      if (
        typeof police_clearance != "undefined" &&
        police_clearance.length > 0
      ) {
        driver.police_clearance =
          police_clearance[0].destination + "/" + police_clearance[0].filename;
      }
      if (typeof license != "undefined" && license.length > 0) {
        driver.driving_license =
          license[0].destination + "/" + license[0].filename;
      }
      driver.license_expiry = license_expiry;
      driver.license_number = license_number;
      driver.resubmitted = true;
      // driver.resubmitted_at = new Date();
      driver.resubmitted_at = Date.now();
      (driver.is_approved = false),
        (driver.is_rejected = false),
        (driver.profile_completed = true);
      await driver.save();
      return res.json({
        status: true,
        message: "Details has been resubmitted for admin verification",
      });
    } else {
      return res.json({
        status: false,
        message: "Sorry something went wrong",
      });
    }
  } catch (err) {
    console.log(err);
    return res.json({
      status: false,
      message: "Sorry something went wrong",
    });
  }
};

exports.generateOtp = async (req, res) => {
  try {
    let { errors, isValid } = ValidateDriverGenerateOTP(req.body);
    if (!isValid) {
      return res.json({
        status: false,
        message: errors[0],
      });
    }
    let { mobile } = req.body;
    mobile = trimMobile(mobile);
    let driver = await Driver.findOne({
      mobile,
      delete_status: false,
    });
    if (driver) {
      let otp = Math.floor(1000 + Math.random() * 9000);
      if (mobile == "9999000000" || mobile == "8939568878") {
        otp = 1111;
      }
      driver.otp = otp;
      await sendSms(mobile, otp);
      await driver.save();
      return res.json({
        status: true,
        message: "An OTP has been send to provided mobile number",
        otp,
      });
    } else {
      return res.json({
        status: false,
        message: "Mobile number is not registered with us",
      });
    }
  } catch (err) {
    console.log(err);
    return res.json({
      status: false,
      message: "Sorry something went wrong",
    });
  }
};

exports.verifyLoginOtp = async (req, res) => {
  try {
    let { errors, isValid } = ValidateDriverVerifyOtp(req.body);
    if (!isValid) {
      return res.json({
        status: false,
        message: errors[0],
      });
    }
    let { otp, mobile } = req.body;
    mobile = trimMobile(mobile);
    let driver = await Driver.findOne({
      mobile,
      delete_status: false,
    });
    if (driver) {
      if (driver.otp == otp) {
        driver.otp = null;
        await driver.save();
        if (driver.profile_completed == false) {
          return res.json({
            status: true,
            message: "Please complete your profile to continue",
            data: driver.toAuthJSON(),
            // data: {
            // 	profile_completed: driver.profile_completed,
            // 	is_approved: driver.is_approved,
            // 	is_rejected: driver.is_rejected,
            // }
          });
        } else {
          if (driver.is_rejected == true) {
            return res.json({
              status: true,
              message: "Your account has been rejected by admin",
              data: driver.toAuthJSON(),
              // data: {
              // 	profile_completed: driver.profile_completed,
              // 	is_approved: driver.is_approved,
              // 	is_rejected: driver.is_rejected,
              // 	admin_review: driver.admin_review,
              // }
            });
          } else if (driver.is_approved == true) {
            return res.json({
              status: true,
              data: driver.toAuthJSON(),
            });
          } else if (
            driver.is_approved == false &&
            driver.is_rejected == false
          ) {
            return res.json({
              status: true,
              data: driver.toAuthJSON(),
              // data: {
              // 	profile_completed: driver.profile_completed,
              // 	is_approved: driver.is_approved,
              // 	is_rejected: driver.is_rejected,
              // 	admin_review: driver.admin_review
              // },
              message: "Waiting for admin approval",
            });
          }
        }
      } else {
        return res.json({
          status: false,
          message: "Invalid OTP",
        });
      }
    } else {
      return res.json({
        status: false,
        message: "Mobile number is not registered with us",
      });
    }
  } catch (err) {
    console.log(err);
    return res.json({
      status: false,
      message: "Sorry something went wrong",
    });
  }
};

exports.driverHome = async (req, res) => {
  try {
    let { shifts, coming_shift } = await this.getComingShift();
    if (coming_shift == null) {
      coming_shift = shifts[0]._id;
    }
    // let coming_shift = ObjectId('5f578a3a6c3b9f18f893e082')
    let query = [];
    query.push(
      {
        $match: {
          _id: ObjectId(req.payload._id),
        },
      },
      {
        $lookup: {
          from: "stocks",
          let: {},
          pipeline: [
            {
              $match: {
                driver_id: ObjectId(req.payload._id),
                date: new Date(moment().format("YYYY-MM-DD")),
                shift_id: ObjectId(coming_shift),
              },
            },
            {
              $lookup: {
                from: "suburbs",
                let: { suburb_id: "$suburb_id" },
                pipeline: [
                  {
                    $match: {
                      $expr: {
                        $eq: ["$_id", "$$suburb_id"],
                      },
                    },
                  },
                  {
                    $project: {
                      _id: 1,
                      location: 1,
                      name: 1,
                      address: 1,
                      radius: 1,
                    },
                  },
                ],
                as: "suburb",
              },
            },
            {
              $addFields: {
                suburb: {
                  $arrayElemAt: ["$suburb", 0],
                },
              },
            },
            {
              $project: {
                _id: 1,
                products: 1,
                suburb: 1,
              },
            },
            {
              $group: {
                _id: "$_id",
                suburb: {
                  $push: "$suburb",
                },
                total_stock: {
                  $sum: {
                    $sum: "$products.stock",
                  },
                },
              },
            },
            {
              $addFields: {
                suburb: {
                  $arrayElemAt: ["$suburb", 0],
                },
              },
            },
          ],
          as: "stocks",
        },
      },
      {
        $addFields: {
          total_stock: {
            $sum: {
              $sum: "$stocks.total_stock",
            },
          },
        },
      },
      {
        $project: {
          _id: 1,
          name: 1,
          email: 1,
          mobile: 1,
          address: 1,
          image: 1,
          suburbs: "$stocks.suburb",
          suburb_ids: "$stocks.suburb._id",
          total_stock: 1,
        },
      }
    );
    let driver = await Driver.aggregate(query);
    let data = driver[0];
    // check driver started or not
    let driver_log = await DriverLog.findOne({
      date: new Date(moment().format("YYYY-MM-DD")),
      driver_id: req.payload._id,
      shift_id: coming_shift,
    });
    if (
      driver_log &&
      driver_log.service_start_time &&
      driver_log.service_end_time == null
    ) {
      data.service_started = true;
    } else {
      data.service_started = false;
    }

    // scheduled booking counts from suburbs
    let scheduled_orders = await Booking.aggregate([
      {
        $match: {
          booking_type: "SCHEDULED",
          delivery_type: "ONLINE",
          scheduled_date: new Date(moment().format("YYYY-MM-DD")),
          shift_id: ObjectId(coming_shift),
          redeemed: false,
          delete_status: false,
        },
      },
      {
        $lookup: {
          from: "addresses",
          let: {
            suburb_ids: data.suburb_ids,
            user_id: "$user_id",
            address_id: "$address_id",
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    {
                      $in: ["$suburb_id", "$$suburb_ids"],
                    },
                    {
                      $eq: ["$user_id", "$$user_id"],
                    },
                    {
                      $eq: ["$_id", "$$address_id"],
                    },
                  ],
                },
              },
            },
          ],
          as: "addresses",
        },
      },
      {
        $unwind: "$addresses",
      },
      // {
      // 	$count: "count"
      // }
    ]);
    data.scheduled_orders_count = scheduled_orders.length;
    let shift = await Settings.findOne(
      { "shift_times._id": ObjectId(coming_shift) },
      { shift_times: { $elemMatch: { _id: ObjectId(coming_shift) } } }
    );
    data.current_shift = shift.shift_times[0];
    return res.json({
      status: true,
      data,
    });
  } catch (err) {
    console.log(err);
    return res.json({
      status: false,
      message: "Sorry something went wrong",
    });
  }
};

exports.foodList = async (req, res) => {
  try {
    let foods = await Product.find(
      {
        delete_status: false,
        is_regular: true,
        type: "FOOD",
      },
      {
        name: 1,
        image: 1,
        cover_pic: 1,
        is_veg: 1,
      }
    );
    return res.json({
      status: true,
      data: foods,
    });
  } catch (err) {
    console.log(err);
    return res.json({
      status: false,
      message: "Sorry something went wrong",
    });
  }
};

exports.stockUpdatesTest = async (req, res) => {
  try {
    let { shifts, coming_shift } = await this.getComingShift();
    let stock_updates = await Stock.aggregate([
      {
        $match: {
          shift_id: ObjectId(coming_shift),
          driver_id: ObjectId(req.payload._id),
          date: new Date(moment().format("YYYY-MM-DD")),
          type: "DELIVERY",
          delete_status: false,
        },
      },
      {
        $group: {
          _id: "$driver_id",
          products: {
            $push: "$products",
          },
        },
      },
      {
        $unwind: "$products",
      },
      {
        $unwind: "$products",
      },
      {
        $lookup: {
          from: "products",
          let: {
            product_id: "$products.product_id",
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: ["$_id", "$$product_id"],
                },
              },
            },
          ],
          as: "product_details",
        },
      },
      {
        $addFields: {
          product_details: {
            $arrayElemAt: ["$product_details", 0],
          },
        },
      },
      {
        $group: {
          _id: {
            _id: "$_id",
            product_id: "$products.product_id",
          },
          stock_total: {
            $sum: "$products.stock",
          },
          products: {
            $push: "$product_details",
          },
        },
      },
      {
        $addFields: {
          products: {
            $arrayElemAt: ["$products", 0],
          },
        },
      },
      {
        $project: {
          driver_id: "$_id._id",
          _id: "$products._id",
          cover_pic: "$products.cover_pic",
          type: "$products.type",
          name: "$products.name",
          price: "$products.price",
          description: "$products.description",
          image: "$products.image",
          is_veg: "$products.is_veg",
          allergen_contents: "$products.allergen_contents",
          ingredients: "$products.ingredients",
          container_size: "$products.container_size",
          stock: "$stock_total",
        },
      },
      {
        $group: {
          _id: "$driver_id",
          products: {
            $push: {
              _id: "$_id",
              cover_pic: "$cover_pic",
              type: "$type",
              name: "$name",
              price: "$price",
              description: "$description",
              image: "$image",
              is_veg: "$is_veg",
              allergen_contents: "$allergen_contents",
              ingredients: "$ingredients",
              container_size: "$container_size",
              stock: "$stock",
            },
          },
          total_stocks: {
            $sum: "$stock",
          },
        },
      },
      {
        $project: {
          _id: 0,
        },
      },
    ]);
    var data = {};
    if (stock_updates.length > 0) {
      data = stock_updates[0];
    }
    return res.json({
      status: true,
      data,
    });
  } catch (err) {
    console.log(err);
    return res.json({
      status: false,
      message: "Sorry something went wrong",
    });
  }
};

exports.stockUpdates = async (req, res) => {
  try {
    let { shifts, coming_shift } = await this.getComingShift();
    let stock_updates = await Stock.aggregate([
      {
        $match: {
          shift_id: ObjectId(coming_shift),
          driver_id: ObjectId(req.payload._id),
          date: new Date(moment().format("YYYY-MM-DD")),
        },
      },
      {
        $unwind: {
          path: "$products",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: "products",
          let: { product_id: "$products.product_id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: ["$$product_id", "$_id"],
                },
              },
            },
            {
              $project: {
                _id: 1,
                cover_pic: 1,
                type: 1,
                name: 1,
                price: 1,
                description: 1,
                image: 1,
              },
            },
          ],
          as: "product_details",
        },
      },
      {
        $addFields: {
          product_details: {
            $arrayElemAt: ["$product_details", 0],
          },
        },
      },
      {
        $group: {
          _id: {
            _id: "$_id",
            boxes: "$boxes",
            suburb_id: "$suburb_id",
            shift_id: "$shift_id",
            type: "$type",
            driver_id: "$driver_id",
            vehicle_id: "$vehicle_id",
            date: "$date",
          },
          products: {
            $push: {
              _id: "$product_details._id",
              cover_pic: "$product_details.cover_pic",
              type: "$product_details.type",
              name: "$product_details.name",
              price: "$product_details.price",
              description: "$product_details.description",
              image: "$product_details.image",
              stock: "$products.stock",
            },
          },
          total_stocks: {
            $sum: "$products.stock",
          },
        },
      },
      {
        $project: {
          _id: 0,
          products: "$products",
          total_stocks: "$total_stocks",
        },
      },
    ]);
    return res.json({
      status: true,
      data: stock_updates[0],
    });
  } catch (err) {
    console.log(err);
    return res.json({
      status: false,
      message: "Sorry something went wrong",
    });
  }
};

exports.requestFood = async (req, res) => {
  try {
    let { shifts, coming_shift } = await this.getComingShift();
    let { products, quantities } = req.body;
    if (!products || !quantities) {
      return res.json({
        status: false,
        message: "Products and quantities are required",
      });
    }
    if (products.length != quantities.length) {
      return res.json({
        status: false,
        message: "Products and counts are required",
      });
    }
    let requests = [];
    for (var i = 0; i < products.length; i++) {
      let details = {
        product_id: products[i],
        quantity: quantities[i],
      };
      requests.push(details);
    }
    let food_request = new StockRequest({
      driver_id: req.payload._id,
      date: new Date(moment().format("YYYY-MM-DD")),
      shift_id: coming_shift,
      requests: requests,
    });
    await food_request.save();
    console.log("$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$")
    sendDriverFoodRequest.add({
      driver_id: req.payload._id,
      food_request_id: food_request._id
    })
    return res.json({
      status: true,
      message: "Food request submitted. Waiting for admin approval",
    });
  } catch (err) {
    console.log(err);
    return res.json({
      status: false,
      message: "Sorry something went wrong",
    });
  }
};

exports.fetchLocation = async (req, res) => {
  try {
    let { errors, isValid } = ValidateDriverLocationInput(req.body);
    if (!isValid) {
      return res.json({
        status: false,
        message: errors[0],
      });
    }

    let { shifts, coming_shift } = await this.getComingShift();
    // let coming_shift = ObjectId('5f578a3a6c3b9f18f893e082')
    let { lat, lng } = req.body;

    await Driver.updateOne(
      {
        _id: req.payload._id,
      },
      {
        $set: {
          location: {
            type: "Point",
            coordinates: [parseFloat(lng), parseFloat(lat)],
          },
        },
      }
    );
    // console.log("____________________________Location updated");

    let driver_log = await DriverLog.findOne({
      date: new Date(moment().format("YYYY-MM-DD")),
      driver_id: req.payload._id,
      shift_id: coming_shift,
      service_end_time: null,
    });
    // return res.json({driver_log})
    if (driver_log && driver_log.dedicated_start_time == null) {
      let driver_stock = await Stock.aggregate([
        {
          $match: {
            driver_id: ObjectId(req.payload._id),
            shift_id: ObjectId(coming_shift),
            date: new Date(moment().format("YYYY-MM-DD")),
            type: "DELIVERY",
          },
        },
        {
          $group: {
            _id: null,
            suburb_ids: {
              $push: "$suburb_id",
            },
          },
        },
      ]);
      let suburbs = await Suburb.aggregate([
        {
          $geoNear: {
            near: {
              type: "Point",
              coordinates: [parseFloat(lng), parseFloat(lat)],
            },
            key: "location",
            spherical: true,
            distanceField: "distance",
            distanceMultiplier: 0.001,
          },
        },
        {
          $match: {
            _id: {
              $in: driver_stock[0].suburb_ids,
            },
          },
        },
        {
          $addFields: {
            distance_to_cover: {
              $subtract: ["$distance", "$radius"],
              // $multiply: [
              // 	{
              // 		$subtract: ["$distance", "$radius"]
              // 	}, 0.001
              // ]
            },
          },
        },
        {
          $sort: {
            distance_to_cover: 1,
          },
        },
      ]);
      // return res.json({
      // 	suburbs
      // })
      if (parseFloat(suburbs[0].distance_to_cover) < parseFloat(0.9)) {
        driver_log.dedicated_start_time = new Date();
        driver_log.dedicated_start_location = {
          type: "Point",
          coordinates: [parseFloat(lng), parseFloat(lat)],
        };
        await driver_log.save();
        let driver = await Driver.findOne({ _id: req.payload._id });
        await SendNotificaiton(
          "Dedicated time starts now",
          "You are 1KM away from your allocated suburb. Your dedicated time starts now",
          "high",
          driver.device_token
        );
      }
    }
    return res.json({
      status: true,
      message: "Location has been updated",
    });
  } catch (err) {
    console.log(err);
    return res.json({
      status: false,
      message: "Sorry something went wrong",
    });
  }
};

exports.scheduledOrders = async (req, res) => {
  try {
    let { shifts, coming_shift } = await this.getComingShift();
    let stock_details = await Stock.findOne({
      driver_id: req.payload._id,
      type: "DELIVERY",
      delete_status: false,
      shift_id: coming_shift,
      date: new Date(moment().format("YYYY-MM-DD")),
    });
    if (!stock_details) {
      return res.json({
        status: false,
        message: "No stocks allocated by admin.",
      });
    }
    let query = [];
    query.push(
      {
        $match: {
          booking_type: "SCHEDULED",
          delete_status: false,
          $expr: {
            $and: [
              {
                $gte: [
                  "$scheduled_date",
                  new Date(moment().format("YYYY-MM-DD")),
                ],
              },
              {
                $lt: [
                  "$scheduled_date",
                  new Date(moment().add(1, "days").format("YYYY-MM-DD")),
                ],
              },
            ],
          },
          delivery_type: "ONLINE",
        },
      },
      {
        $lookup: {
          from: "addresses",
          let: {
            address_id: "$address_id",
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: ["$$address_id", "$_id"],
                },
              },
            },
            {
              $project: {
                _id: 1,
                location: 1,
                address_type: 1,
                address_line1: 1,
                house_flat_no: 1,
                appartment: 1,
                landmark: 1,
                to_reach: 1,
                pincode: 1,
                suburb_id: 1,
              },
            },
          ],
          as: "address",
        },
      },
      {
        $addFields: {
          address: {
            $arrayElemAt: ["$address", 0],
          },
        },
      },
      {
        $lookup: {
          from: "users",
          let: {
            user_id: "$user_id",
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: ["$_id", "$$user_id"],
                },
              },
            },
            {
              $project: {
                _id: true,
                profile_pic: true,
                name: true,
                email: true,
                mobile: true,
              },
            },
          ],
          as: "user_details",
        },
      },
      {
        $addFields: {
          user_details: {
            $arrayElemAt: ["$user_details", 0],
          },
        },
      }
    );
    let scheduled_orders = await Booking.aggregate(query);
    let orders = [];
    if (scheduled_orders && stock_details) {
      for (var i = 0; i < scheduled_orders.length; i++) {
        if (
          stock_details.suburb_id.toString() ==
          scheduled_orders[i].address.suburb_id.toString()
        ) {
          orders.push(scheduled_orders[i]);
        }
      }
    }
    return res.json({
      status: true,
      orders,
      stock_details,
      scheduled_orders,
    });
  } catch (err) {
    console.log(err);
    return res.json({
      status: false,
      message: "Sorry something went wrong",
    });
  }
};

exports.startService = async (req, res) => {
  try {
    let { errors, isValid } = ValidateDriverStartService(req.body);
    if (!isValid) {
      return res.json({
        status: false,
        message: errors[0],
      });
    }
    let { lat, lng } = req.body;
    let { shifts, coming_shift } = await this.getComingShift();
    // return res.json({
    // 	coming_shift
    // })
    // let coming_shift = ObjectId('5f578a3a6c3b9f18f893e082')
    let stock = await Stock.findOne({
      date: new Date(moment().format("YYYY-MM-DD")),
      driver_id: req.payload._id,
      shift_id: coming_shift,
      type: "DELIVERY",
      delete_status: false,
    });
    // return res.json({stock})
    if (!stock) {
      return res.json({
        status: false,
        message: "No stock allocated for you please contact admin",
      });
    } else {
      var driver_log = await DriverLog.findOne({
        date: new Date(moment().format("YYYY-MM-DD")),
        driver_id: req.payload._id,
        shift_id: coming_shift,
      });
      if (driver_log) {
        return res.json({
          status: false,
          message: "Service for the shift already started.",
        });
      }
      driver_log = new DriverLog();
      (driver_log.date = new Date(moment().format("YYYY-MM-DD"))),
        (driver_log.driver_id = req.payload._id),
        (driver_log.shift_id = coming_shift),
        (driver_log.service_start_time = new Date()),
        (driver_log.service_start_location = {
          coordinates: [parseFloat(lng), parseFloat(lat)],
        });
      await driver_log.save();
      return res.json({
        status: true,
        message: "Service time has started",
      });
    }
  } catch (err) {
    console.log(err);
    return res.json({
      status: false,
      message: "Sorry something went wrong",
    });
  }
};

exports.stopService = async (req, res) => {
  try {
    let { errors, isValid } = ValidateDriverStartService(req.body);
    if (!isValid) {
      return res.json({
        status: false,
        message: errors[0],
      });
    }
    let { lat, lng } = req.body;
    let { shifts, coming_shift } = await this.getComingShift();
    // let coming_shift = ObjectId('5f578a3a6c3b9f18f893e082')
    await DriverLog.updateOne(
      {
        date: new Date(moment().format("YYYY-MM-DD")),
        driver_id: req.payload._id,
        shift_id: coming_shift,
      },
      {
        $set: {
          service_end_time: Date.now(),
          service_end_location: {
            coordinates: [parseFloat(lng), parseFloat(lat)],
          },
        },
      }
    );
    return res.json({
      status: true,
      message: "Service time has been stopped",
    });
  } catch (err) {
    console.log(err);
    return res.json({
      status: false,
      message: "Sorry something went wrong",
    });
  }
};

exports.alertAdmin = async (req, res) => {
  try {
    let { shifts, coming_shift } = await this.getComingShift();
    let { errors, isValid } = ValidateDriverAlerAdmin(req.body);
    if (!isValid) {
      return res.json({
        status: false,
        message: errors[0],
      });
    }
    let { reason, lat, lng } = req.body;
    let driver_alert = new DriverAlert({
      driver_id: req.payload._id,
      reason: reason,
      shift_id: coming_shift,
      location: {
        coordinates: [parseFloat(lng), parseFloat(lat)],
      },
      created_at: Date.now(),
    });
    await Booking.updateMany({
      scheduled_date: new Date(moment().format('YYYY-MM-DD')),
      shift_id: coming_shift,
      driver_id: req.payload._id,
      redeemed: false,
    }, {
      $unset: {
        driver_id: 1
      }
    })
    let start_date = new Date(moment().format('YYYY-MM-DD 00:00:000'))
    let end_date = new Date(moment().format('YYYY-MM-DD 23:59'))
    await BookingSlot.deleteMany({
      // date: new Date(moment().format('YYYY-MM-DD')),
      shift_id: coming_shift,
      driver_id: req.payload._id,
      $and: [
        {
          date: {
            $gte: start_date
          }
        },
        {
          date: {
            $lte: end_date
          }
        }
      ]
    })
    await driver_alert.save();
    await DriverLog.updateOne(
      {
        date: new Date(moment().format("YYYY-MM-DD")),
        driver_id: req.payload._id,
        shift_id: coming_shift,
      },
      {
        $set: {
          service_end_time: new Date(),
          serivce_end_location: {
            coordinates: [parseFloat(lng), parseFloat(lat)],
          },
        },
      }
    );
    let driver_details = await Driver.findOne({
      _id: req.payload._id
    })
    await sendAlertSms(driver_details, reason)
    return res.json({
      status: true,
      message: "Alert has been submited!",
    });
  } catch (err) {
    console.log(err);
    return res.json({
      status: false,
      message: "Sorry something went wrong",
    });
  }
};

exports.ordersTest = async (req, res) => {
  try {
    let { shifts, coming_shift } = await this.getComingShift();
    // let coming_shift = ObjectId('5f578a3a6c3b9f18f893e082')
    console.log(coming_shift);
    let driver_stocks = await Stock.aggregate([
      {
        $match: {
          date: new Date(moment().format("YYYY-MM-DD")),
          shift_id: ObjectId(coming_shift),
          driver_id: ObjectId(req.payload._id),
        },
      },
    ]);
    if (driver_stocks.length == 0) {
      return res.json({
        status: false,
        message: "No stock has been assigned to you",
      });
    }
    let suburb_id = driver_stocks[0].suburb_id;
    let bookings = await Booking.aggregate([
      {
        $match: {
          $or: [{ booking_type: "REALTIME" }, { booking_type: "SCHEDULED" }],
          delivery_type: "ONLINE",
          scheduled_date: new Date(moment().format("YYYY-MM-DD")),
          shift_id: ObjectId(coming_shift),
          redeemed: false,
          delete_status: false,
        },
      },
      {
        $lookup: {
          from: "addresses",
          let: { address_id: "$address_id" },
          pipeline: [
            {
              $match: {
                suburb_id: ObjectId(suburb_id),
                $expr: {
                  $eq: ["$_id", "$$address_id"],
                },
              },
            },
          ],
          as: "delivery_address",
        },
      },
      {
        $addFields: {
          delivery_address: {
            $arrayElemAt: ["$delivery_address", 0],
          },
        },
      },
      // {
      // 	$match: {
      // 		"delivery_address.suburb_id": suburb_id
      // 	}
      // },
      {
        $unwind: "$orders",
      },
      {
        $lookup: {
          from: "products",
          let: {
            product_id: "$orders.product_id",
            quantity: "$orders.quantity",
            price: "$orders.price",
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: ["$_id", "$$product_id"],
                },
              },
            },
            {
              $project: {
                _id: 1,
                cover_pic: 1,
                type: 1,
                name: 1,
                description: 1,
                image: 1,
                allergen_contents: 1,
                type: 1,
              },
            },
            {
              $addFields: {
                quantity: "$$quantity",
                price: "$$price",
              },
            },
          ],
          as: "product",
        },
      },
      {
        $addFields: {
          orders: {
            $arrayElemAt: ["$product", 0],
          },
        },
      },
      {
        $group: {
          _id: {
            _id: "$_id",
            booking_type: "$booking_type",
            redeemed: "$redeemed",
            delete_status: "$delete_status",
            created_at: "$created_at",
            booking_id: "$booking_id",
            user_id: "$user_id",
            delivery_type: "$delivery_type",
            address_id: "$address_id",
            scheduled_date: "$scheduled_date",
            shift_id: "$shift_id",
            qrcode: "$qrcode",
            delivery_address: "$delivery_address",
          },
          orders: {
            $push: "$orders",
          },
        },
      },
      {
        $project: {
          _id: "$_id._id",
          booking_type: "$_id.booking_type",
          created_at: "$_id.created_at",
          booking_id: "$_id.booking_id",
          user_id: "$_id.user_id",
          delivery_type: "$_id.delivery_type",
          address_id: "$_id.address_id",
          scheduled_date: "$_id.scheduled_date",
          shift_id: "$shift_id",
          qrcode: "$_id.qrcode",
          delivery_address: "$_id.delivery_address",
          orders: "$orders",
        },
      },
      {
        $lookup: {
          from: "users",
          let: {
            user_id: "$user_id",
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: ["$_id", "$$user_id"],
                },
              },
            },
          ],
          as: "user_details",
        },
      },
      {
        $addFields: {
          user_details: {
            $arrayElemAt: ["$user_details", 0],
          },
        },
      },
      {
        $lookup: {
          from: "driver_logs",
          let: {
            delivery_location: "$delivery_address.location",
          },
          pipeline: [
            {
              $addFields: {
                delivery_lat: {
                  $arrayElemAt: ["$$delivery_location.coordinates", 1],
                },
                delivery_lng: {
                  $arrayElemAt: ["$$delivery_location.coordinates", 0],
                },
                delivery_location: "$$delivery_location",
              },
            },
            {
              $match: {
                date: new Date(moment().format("YYYY-MM-DD")),
                shift_id: ObjectId(coming_shift),
                service_start_time: {
                  $ne: null,
                },
                service_end_time: null,
                suburb_id: ObjectId(suburb_id),
              },
            },
            {
              $lookup: {
                from: "drivers",
                let: {
                  driver_id: "$driver_id",
                  delivery_location: "$delivery_location",
                },
                pipeline: [
                  {
                    $lookup: {
                      from: "stocks",
                      let: {
                        driver_id: "$_id",
                      },
                      pipeline: [
                        {
                          $match: {
                            date: new Date(moment().format("YYYY-MM-DD")),
                            suburb_id: ObjectId(suburb_id),
                            $expr: {
                              $eq: ["$driver_id", "$$driver_id"],
                            },
                          },
                        },
                      ],
                      as: "stocks",
                    },
                  },
                  {
                    $addFields: {
                      stocks: {
                        $arrayElemAt: ["$stocks", 0],
                      },
                    },
                  },
                  {
                    $match: {
                      $expr: {
                        $eq: ["$_id", "$$driver_id"],
                      },
                    },
                  },
                ],
                as: "driver",
              },
            },
            {
              $addFields: {
                driver: {
                  $arrayElemAt: ["$driver", 0],
                },
              },
            },
          ],
          as: "driver_logs",
        },
      },
    ]);
    
    for (var i = 0; i < bookings.length; i++) {
      for (var j = 0; j < bookings[i].driver_logs.length; j++) {
        let driver_distance = await Driver.aggregate([
          {
            $geoNear: {
              near: bookings[i].delivery_address.location,
              key: "location",
              spherical: true,
              distanceField: "distance",
              distanceMultiplier: 0.001,
            },
          },
          {
            $match: {
              _id: ObjectId(bookings[i].driver_logs[j].driver_id),
            },
          },
        ]);
        bookings[i].driver_logs[j].driver.distance =
          driver_distance[0].distance;

        for (var k = 0; k < bookings[i].orders.length; k++) {
          for (
            var l = 0;
            l < bookings[i].driver_logs[j].driver.stocks.products.length;
            l++
          ) {
            if (
              bookings[i].orders[k]._id.toString() ==
              bookings[i].driver_logs[j].driver.stocks.products[
                l
              ].product_id.toString()
            ) {
              if (
                bookings[i].orders[k].quantity <=
                bookings[i].driver_logs[j].driver.stocks.products[l].stock
              ) {
                bookings[i].driver_logs[j].driver.acceptable = true;
              } else {
                bookings[i].driver_logs[j].driver.acceptable = false;
              }
            }
          }
        }
      }
    }
    let outputArray = [];
    for (var i = 0; i < bookings.length; i++) {
      if (bookings[i].driver_logs[0]) {
        var short_distance = bookings[i].driver_logs[0].driver.distance;
        var driver_id = bookings[i].driver_logs[0].driver_id;
        for (var j = 0; j < bookings[i].driver_logs.length; j++) {
          if (bookings[i].driver_logs[j].driver.acceptable == true) {
            if (short_distance > bookings[i].driver_logs[j].driver.distance) {
              short_distance = bookings[i].driver_logs[j].driver.distance;
              driver_id = bookings[i].driver_logs[j].driver_id;
            }
          }
          
        }
        if (driver_id.toString() == req.payload._id.toString()) {
          let myorders = {
            _id: bookings[i]._id,
            booking_type: bookings[i].booking_type,
            created_at: bookings[i].created_at,
            booking_id: bookings[i].booking_id,
            scheduled_date: bookings[i].scheduled_date,
            drlivery_address: {
              location: bookings[i].delivery_address.location,
              address_type: bookings[i].delivery_address.address_type,
              address_line1: bookings[i].delivery_address.address_line1,
              house_flat_no: bookings[i].delivery_address.house_flat_no,
              appartment: bookings[i].delivery_address.appartment,
              landmark: bookings[i].delivery_address.landmark,
              to_reach: bookings[i].delivery_address.to_reach,
              contact_person: bookings[i].delivery_address.contact_person,
            },
            user_details: {
              name: bookings[i].user_details.name,
              email: bookings[i].user_details.email,
              mobile: bookings[i].user_details.mobile,
            },
            orders: bookings[i].orders,
          };
          outputArray.push(myorders);
        }
        // console.log(driver_id + "------------" + short_distance)
      }
    }
    console.log(req.payload._id);
    return res.json({
      status: true,
      data: outputArray,
      // service_started_drivers,
      // bookings,
    });
  } catch (err) {
    console.log(err);
    return res.json({
      status: false,
      message: "Sorry something went wrong",
    });
  }
};

exports.updateDriverStock = async (stock_id, orders) => {
  for (var i = 0; i < orders.length; i++) {
    await Stock.updateOne(
      {
        _id: stock_id,
        products: {
          $elemMatch: {
            product_id: ObjectId(orders[i].product_id),
          },
        },
      },
      {
        $inc: {
          "products.$.stock": -orders[i].quantity,
        },
      }
    );
  }
};

exports.deliverOrder = async (req, res) => {
  try {
    let { errors, isValid } = ValidateDriverDeliverOrder(req.body);
    if (!isValid) {
      return res.json({
        status: false,
        message: errors[0],
      });
    }
    let { _id, delivered_as } = req.body;
    let booking = await Booking.findOne({
      _id,
      redeemed: false,
    }).populate("address_id");
    // let driver_stock_suburb = await Stock.aggregate([
    // 	{
    // 		$match: {
    // 			suburb_id: booking.address_id.suburb_id,
    // 			date: new Date(moment().format('YYYY-MM-DD')),
    // 			driver_id: ObjectId(req.payload._id),
    // 			shift_id: ObjectId(booking.shift_id),
    // 			type: 'DELIVERY'
    // 		}
    // 	},
    // 	{
    // 		$addFields: {
    // 			booked_orders: booking.orders
    // 		}
    // 	},
    // 	{
    // 		$addFields: {
    // 			have_both: {
    // 				$filter: {
    // 					input: "$booked_orders",
    // 					as: 'order',
    // 					cond: {
    // 						$anyElementTrue: {
    // 							$map: {
    // 								input: "$products",
    // 								as: "product",
    // 								in: {
    // 									$and: [
    // 										{
    // 											$eq: ["$$product.product_id", "$$order.product_id"]
    // 										},
    // 										{
    // 											$gte: ["$$product.stock", "$$order.quantity"]
    // 										}
    // 									]
    // 								}
    // 							}
    // 						}
    // 					}
    // 				}
    // 			}
    // 		}
    // 	},
    // 	{
    // 		$addFields: {
    // 			single_suburb: {
    // 				$cond: {
    // 					if: {
    // 						$eq: [
    // 							{
    // 								$size: "$booked_orders"
    // 							},
    // 							{
    // 								$size: "$have_both"
    // 							}
    // 						]
    // 					},
    // 					then: true,
    // 					else: false
    // 				}
    // 			}
    // 		}
    // 	}
    // ])
    // if(driver_stock_suburb.length > 0 && driver_stock_suburb[0].single_suburb == true) {
    // 	await this.updateDriverStock(driver_stock_suburb[0]._id, booked_orders)
    // } else {
    // 	let driver_stock = await Stock.aggregate([
    // 		{
    // 			$match: {
    // 				date: new Date(moment().format('YYYY-MM-DD')),
    // 				driver_id: ObjectId(req.payload._id),
    // 				shift_id: ObjectId(booking.shift_id),
    // 				type: 'DELIVERY'
    // 			}
    // 		},
    // 		{
    // 			$addFields: {
    // 				booked_orders: booking.orders
    // 			}
    // 		},
    // 		{
    // 			$addFields: {
    // 				have_both: {
    // 					$filter: {
    // 						input: "$booked_orders",
    // 						as: 'order',
    // 						cond: {
    // 							$anyElementTrue: {
    // 								$map: {
    // 									input: "$products",
    // 									as: "product",
    // 									in: {
    // 										$and: [
    // 											{
    // 												$eq: ["$$product.product_id", "$$order.product_id"]
    // 											},
    // 											{
    // 												$gte: ["$$product.stock", "$$order.quantity"]
    // 											}
    // 										]
    // 									}
    // 								}
    // 							}
    // 						}
    // 					}
    // 				}
    // 			}
    // 		},
    // 	])
    // 	// return res.json({
    // 	// 	driver_stock
    // 	// })
    // 	// for(var i = 0; i < booking.length; i++) {
    // 	// 	for(var j = 0; j < booking[i].orders.length; j++) {
    // 	// 		let stockk = await Stock.updae
    // 	// 	}
    // 	// }
    // }

    if (booking) {
      // mark order as booked mark delivery time , delivered by, cod cash recieved if cod,
      (booking.redeemed = true),
        (booking.delivered_by = req.payload._id),
        (booking.delivered_time = Date.now());
      booking.delivered_as = delivered_as;
      await booking.save();

      await BookingSlot.deleteOne({
        booking_id: booking._id,
      });
      // reduce stock from driver current stock
      let driver_stock = await Stock.findOne({
        suburb_id: booking.address_id.suburb_id,
        date: new Date(moment().format("YYYY-MM-DD")),
        driver_id: req.payload._id,
        shift_id: booking.shift_id,
        type: "DELIVERY",
      });
      for (var i = 0; i < booking.orders.length; i++) {
        await Stock.updateOne(
          {
            _id: driver_stock._id,
            products: {
              $elemMatch: {
                product_id: ObjectId(booking.orders[i].product_id),
              },
            },
          },
          {
            $inc: {
              "products.$.stock": -booking.orders[i].quantity,
            },
          }
        );
      }
      // mark delivered details like order details to driver_logs
      // let driver_log = await DriverLog.findOne({
      // 	date: new Date(moment().format('YYYY-MM-DD')),
      // 	driver_id: req.payload._id,
      // 	shift_id: driver_stock.shift_id,
      // })
      // let delivered_items = []
      // if (driver_log.delivered_items) {
      // 	delivered_items = driver_log.delivered_items
      // }
      // for (var i = 0; i < booking.orders.length; i++) {
      // 	let product = await Product.findOne({
      // 		_id: ObjectId(booking.orders[i].product_id)
      // 	})
      // 	let details = {
      // 		delivered_user: booking.user_id,
      // 		name: product.name,
      // 		image: product.image,
      // 		cover_pic: product.cover_pic,
      // 		description: product.description,
      // 		price: product.price,
      // 		type: product.type,
      // 		allergen_contents: product.allergen_contents,
      // 		is_veg: products.is_veg,
      // 		quantity: booking.orders[i].quantity
      // 	}
      // 	delivered_items.push(details)
      // }
      // driver_log.delivered_items = delivered_items
      // await driver_log.save()
      await this.refreshSlots({
        shift_id: booking.shift_id,
        driver_id: req.payload._id,
      });

      // await this.updateBookingOrder({
      //   driver_id: req.payload._id
      // })
      // push notification to users pending
      let user = await User.findOne({
        _id: booking.user_id,
      });
      (title = "Order Delivered"),
        (description = "Your order has been delivered"),
        (token = user.device_token);
      await SendNotificaiton(title, description, "high", token);
      return res.json({
        status: true,
        message: "Delivered successfully",
        // driver_stock,
        // booking
      });
    } else {
      return res.json({
        status: false,
        message: "Product already delivered",
      });
    }
  } catch (err) {
    console.log(err);
    return res.json({
      status: false,
      message: "Sorry something went wrong",
    });
  }
};


exports.deliverOrder = async(req, res) => {
  try {
    let { errors, isValid } = ValidateDriverDeliverOrder(req.body)
    if(!isValid) {
      return res.json({
        status: false,
        message: errors[0]
      })
    }
    let { _id, delivered_as } = req.body
    let booking = await Booking.findOne({
      _id,
      redeemed: false
    })
    if(booking) {
      let selected_products = booking.orders
      let stocks = await Stock.aggregate([
        {
          $match: {
            delete_status: false,
            date: new Date(moment().format('YYYY-MM-DD')),
            driver_id: ObjectId(req.payload._id),
            shift_id: ObjectId(booking.shift_id),
            type: 'DELIVERY'
          }
        },
        {
          $project: {
            stocks: "$products",
            suburb_id: "$suburb_id"
          }
        }
      ])

      let unique_stock_products = [];
      let unique_ordered_products = [];
    
      let stock_products = [];
    
      stocks.map(stock=>{
        let {stocks : tmp_stocks, suburb_id, _id: stock_id} = stock;
        tmp_stocks.map(stk=>{
          let { product_id, stock, _id, box_id } = stk;
          if(+stock > 0){
            unique_stock_products.push(product_id.toString())
            stock_products.push({
              stock_id,
              _id,
              product_id,
              box_id,
              suburb_id,
              stock
            })
          }
        })
      });
      selected_products.map(prod=>{
        let { product_id, quantity } = prod;
        if(+quantity > 0){
          unique_ordered_products.push(product_id.toString())
        }
      });
      unique_stock_products = _.uniq(unique_stock_products, x => x);
      unique_ordered_products = _.uniq(unique_ordered_products, x => x);
    
      var is_subset = (unique_ordered_products.length === _.intersection(unique_ordered_products, unique_stock_products).length);
    
      if(!is_subset){
        return res.json({
          status : false,
          message: "Stock unavailable"
        })
      }
      let no_stock = 0;

      unique_ordered_products.map(product_id=>{
        //select ordered_quantity
        let selected_product = selected_products.filter((product)=>{
          return product_id == product.product_id.toString()
        })
    
        if(selected_product.length > 0){
          let quantity = selected_product[0].quantity;
          
          stock_products.map(product=>{
            let {stock, product_id: prod_id } = product
            if(prod_id.toString()  ==  product_id){
              if(quantity > stock){
                quantity = quantity - stock;
                stock = 0;
              }else{
                stock = stock -quantity;
                quantity = 0;
              }
            }
            product.stock = stock;
            console.log({product})
            return product;
          })
    
          if(quantity > 0){
            no_stock = 1;
          }
        }
    
      });
    
      if(no_stock){
        return res.json({
          status : false,
          message: "Stock unavailable"
        })
      }
      
      for(var i = 0; i < stock_products.length; i++) {
        await Stock.updateOne(
          {
            _id: stock_products[i].stock_id,
            products: {
              $elemMatch: {
                product_id: ObjectId(stock_products[i].product_id)
              }
            }
          },
          {
            $set: {
              "products.$.stock": stock_products[i].stock
            }
          }
        )
      }

      booking.redeemed = true
      booking.delivered_by = req.payload._id
      booking.delivered_time = Date.now()
      booking.delivered_as = delivered_as
      await booking.save()

      await BookingSlot.deleteOne({
        booking_id: booking._id,
      });
      
      await this.refreshSlots({
        shift_id: booking.shift_id,
        driver_id: req.payload._id
      })

      let user = await User.findOne({
        _id: booking.user_id
      })
      title = "Order Delivered"
      description = "Your order has been delivered."
      token = user.device_token
      await SendNotificaiton(title, description, "high", token);
      
      return res.json({
        status: true,
        message: "Delivered successfully"
      })    


      // return res.json({
      //   stocks,
      //   selected_products
      // })
    } else {
      return res.json({
        status: false,
        message: "Sorry somthing went wrong"
      })
    }
  } catch(err) {
    console.log(err)
    return res.json({
      status: false,
      message: "Sorry something went wrong"
    })
  }
}

exports.orders = async (req, res) => {
  try {
    let { shifts, coming_shift } = await this.getComingShift();
    // let coming_shift = ObjectId('5f578a2a6c3b9f18f893e081')
    let driver_stock = await Stock.aggregate([
      {
        $match: {
          date: new Date(moment().format("YYYY-MM-DD")),
          shift_id: ObjectId(coming_shift),
          driver_id: ObjectId(req.payload._id),
        },
      },
      {
        $group: {
          _id: null,
          suburb_ids: {
            $push: "$suburb_id",
          },
        },
      },
    ]);
    if (driver_stock.length == 0) {
      return res.json({
        status: false,
        message: "No stock allocated for you please contact admin",
      });
    }
    let query = [];
    query.push(
      {
        $match: {
          $or: [{ booking_type: "REALTIME" }, { booking_type: "SCHEDULED" }],
          delivery_type: "ONLINE",
          scheduled_date: new Date(moment().format("YYYY-MM-DD")),
          shift_id: ObjectId(coming_shift),
          redeemed: false,
          delete_status: false,
        },
      },
      {
        $unwind: "$orders",
      },
      {
        $lookup: {
          from: "products",
          let: {
            product_id: "$orders.product_id",
            quantity: "$orders.quantity",
            price: "$orders.price",
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: ["$_id", "$$product_id"],
                },
              },
            },
            {
              $project: {
                _id: 1,
                product_id: "$_id",
                cover_pic: 1,
                type: 1,
                allergen_contents: 1,
                name: 1,
                description: 1,
                image: 1,
                is_veg: 1,
              },
            },
            {
              $addFields: {
                quantity: "$$quantity",
                price: "$$price",
              },
            },
          ],
          as: "product",
        },
      },
      {
        $addFields: {
          product: {
            $arrayElemAt: ["$product", 0],
          },
        },
      },
      {
        $group: {
          _id: {
            _id: "$_id",
            booking_type: "$booking_type",
            redeemed: "$redeemed",
            delete_status: "$delete_status",
            created_at: "$created_at",
            booking_id: "$booking_id",
            user_id: "$user_id",
            delivery_type: "$delivery_type",
            address_id: "$address_id",
            scheduled_date: "$scheduled_date",
            shift_id: "$shift_id",
            qrcode: "$qrcode",
            delivery_address: "$delivery_address",
          },
          orders: {
            $push: "$product",
          },
        },
      },
      {
        $project: {
          _id: "$_id._id",
          booking_type: "$_id.booking_type",
          created_at: "$_id.created_at",
          booking_id: "$_id.booking_id",
          user_id: "$_id.user_id",
          delivery_type: "$_id.delivery_type",
          address_id: "$_id.address_id",
          scheduled_date: "$_id.scheduled_date",
          shift_id: "$shift_id",
          qrcode: "$_id.qrcode",
          delivery_address: "$_id.delivery_address",
          products: "$orders",
        },
      },
      {
        $lookup: {
          from: "addresses",
          let: {
            suburb_ids: driver_stock[0].suburb_ids,
            address_id: "$address_id",
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$_id", "$$address_id"] },
                    { $in: ["$suburb_id", "$$suburb_ids"] },
                  ],
                },
              },
            },
          ],
          as: "delivery_address",
        },
      },
      {
        $unwind: "$delivery_address",
      },
      {
        $lookup: {
          from: "stocks",
          let: {
            suburb_ids: driver_stock[0].suburb_ids,
            delivery_location: "$delivery_address.location",
            orders: "$products",
          },
          pipeline: [
            {
              $match: {
                date: new Date(moment().format("YYYY-MM-DD")),
                delete_status: false,
                type: "DELIVERY",
                shift_id: ObjectId(coming_shift),
                $expr: {
                  $in: ["$suburb_id", "$$suburb_ids"],
                },
              },
            },
            {
              $project: {
                _id: 1,
                driver_id: 1,
                products: 1,
              },
            },
            {
              $group: {
                _id: "$driver_id",
                products: {
                  $push: "$products",
                },
              },
            },
            {
              $unwind: "$products",
            },
            {
              $unwind: "$products",
            },
            {
              $group: {
                _id: {
                  _id: "$_id",
                  product_id: "$products.product_id",
                },
                stock_total: {
                  $sum: "$products.stock",
                },
                products: {
                  $push: "$products",
                },
              },
            },
            {
              $project: {
                _id: 0,
                driver_id: "$_id._id",
                stock: "$stock_total",
                product_id: "$_id.product_id",
              },
            },
            {
              $group: {
                _id: "$driver_id",
                products: {
                  $push: {
                    product_id: "$product_id",
                    stock: "$stock",
                  },
                },
              },
            },
            // // products availability for drivers
            {
              $project: {
                _id: 1,
                products: 1,
                is_acceptable: {
                  $and: [
                    {
                      $eq: [
                        {
                          $size: {
                            $setIntersection: [
                              "$products.product_id",
                              "$$orders.product_id",
                            ],
                          },
                        },
                        {
                          $size: {
                            $filter: {
                              input: "$$orders",
                              as: "order",
                              cond: {
                                $anyElementTrue: {
                                  $map: {
                                    input: "$products",
                                    as: "product",
                                    in: {
                                      $and: [
                                        {
                                          $eq: [
                                            "$$product.product_id",
                                            "$$order.product_id",
                                          ],
                                        },
                                        {
                                          $gte: [
                                            "$$product.stock",
                                            "$$order.quantity",
                                          ],
                                        },
                                      ],
                                    },
                                  },
                                },
                              },
                            },
                          },
                        },
                      ],
                    },
                    {
                      $gt: [
                        {
                          $size: {
                            $setIntersection: [
                              "$products.product_id",
                              "$$orders.product_id",
                            ],
                          },
                        },
                        0,
                      ],
                    },
                  ],
                },
                common_products: {
                  $setIntersection: [
                    "$products.product_id",
                    "$$orders.product_id",
                  ],
                },
                have_both: {
                  $filter: {
                    input: "$$orders",
                    as: "order",
                    cond: {
                      $anyElementTrue: {
                        $map: {
                          input: "$products",
                          as: "product",
                          in: {
                            $and: [
                              {
                                $eq: [
                                  "$$product.product_id",
                                  "$$order.product_id",
                                ],
                              },
                              {
                                $gte: ["$$product.stock", "$$order.quantity"],
                              },
                            ],
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
            {
              $match: {
                is_acceptable: true,
              },
            },
            {
              $addFields: {
                delivery_locc: "$$delivery_location",
                delivery_lat: {
                  $arrayElemAt: ["$$delivery_location.coordinates", 1],
                },
                delivery_lng: {
                  $arrayElemAt: ["$$delivery_location.coordinates", 0],
                },
              },
            },
            {
              $lookup: {
                from: "driver_logs",
                let: {
                  driver_id: "$_id",
                },
                pipeline: [
                  {
                    $match: {
                      date: new Date(moment().format("YYYY-MM-DD")),
                      shift_id: ObjectId(coming_shift),
                      service_end_time: null,
                      $expr: {
                        $eq: ["$driver_id", "$$driver_id"],
                      },
                    },
                  },
                ],
                as: "driver_log",
              },
            },
            {
              $unwind: "$driver_log",
            },

            // {
            // 	$lookup: {
            // 		from: "drivers",
            // 		let: {
            // 			driver_id: "$_id",
            // 			delivery_location: "$delivery_location",
            // 			delivery_lat: "$delivery_lat",
            // 			delivery_lng: "$delivery_lng"
            // 		},
            // 		pipeline: [
            // 			{
            // 				$geoNear: {
            // 					near: {
            // 						type: "Point",
            // 						coordinates: [
            // 							76.3215,
            // 							10.0261
            // 						]
            // 					},
            // 					key: "location",
            // 					spherical: true,
            // 					distanceField: "distance",
            // 					distanceMultiplier: 0.001
            // 				}
            // 			},
            // 			{
            // 				$match: {
            // 					$expr: {
            // 						$eq: ["$_id", "$$driver_id"]
            // 					}
            // 				}
            // 			},
            // 			{
            // 				$addFields: {
            // 					delivery_location: "$$delivery_location",
            // 					del_lat: "$$delivery_lat",
            // 					del_lng: "$$delivery_lng"
            // 				}
            // 			}
            // 		],
            // 		as: "driver_details"
            // 	}
            // }
          ],
          as: "driver_stocks",
        },
      },
      {
        $lookup: {
          from: "users",
          let: {
            user_id: "$user_id",
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: ["$_id", "$$user_id"],
                },
              },
            },
            {
              $project: {
                name: 1,
                email: 1,
                mobile: 1,
                profile_pic: 1,
              },
            },
          ],
          as: "user_details",
        },
      },
      {
        $addFields: {
          user_details: {
            $arrayElemAt: ["$user_details", 0],
          },
        },
      }
    );
    let outputArray = [];
    var bookings = await Booking.aggregate(query);
    // return res.json({
    // 	bookings
    // })
    for (var i = 0; i < bookings.length; i++) {
      let driver_array = [];
      for (var j = 0; j < bookings[i].driver_stocks.length; j++) {
        if (bookings[i].driver_stocks[j].is_acceptable == true) {
          var driver_details = await Driver.aggregate([
            {
              $geoNear: {
                near: bookings[i].driver_stocks[j].delivery_locc,
                key: "location",
                spherical: true,
                distanceField: "distance",
                distanceMultiplier: 0.001,
              },
            },
            {
              $match: {
                _id: ObjectId(bookings[i].driver_stocks[j]._id),
              },
            },
          ]);
          // return res.json({
          // 	driver_details
          // })
          driver_array.push(driver_details[0]);
        }
      }
      // driver_array.sort(function (a, b) {
      // 	return a.distance - b.distance
      // })
      // return res.json({
      // 	driver_details
      // })
      if (driver_array.length > 0 && driver_array[0]._id == req.payload._id) {
        // if(driver_array[0]._id == req.payload._id) {
        bookings[i].driver_details = driver_array;
        // outputArray.push(bookings[i])
        let order_details = {
          _id: bookings[i]._id,
          booking_type: bookings[i].booking_type,
          created_at: bookings[i].created_at,
          booking_id: bookings[i].booking_id,
          scheduled_date: bookings.scheduled_date,
          delivery_address: {
            _id: bookings[i].delivery_address._id,
            location: bookings[i].delivery_address.location,
            address_type: bookings[i].delivery_address.address_type,
            address_line1: bookings[i].delivery_address.address_line1,
            house_flat_no: bookings[i].delivery_address.house_flat_no,
            appartment: bookings[i].delivery_address.appartment,
            landmark: bookings[i].delivery_address.landmark,
            to_reach: bookings[i].delivery_address.to_reach,
            contact_person: bookings[i].delivery_address.contact_person,
          },
          products: bookings[i].products,
          user_details: bookings[i].user_details,
          distance: driver_array[0].distance,
        };
        outputArray.push(order_details);
        outputArray.sort(function (a, b) {
          return a.distance - b.distance;
        });
      }
    }

    let driver_log = await DriverLog.findOne({
      driver_id: req.payload._id,
      shift_id: coming_shift,
      date: new Date(moment().format("YYYY-MM-DD")),
    });
    var to_suburb = true;
    if (driver_log && driver_log.dedicated_start_time == null) {
      to_suburb = false;
    }
    if (
      driver_log &&
      driver_log.service_start_time &&
      driver_log.service_end_time == null
    ) {
      service_started = true;
    } else {
      service_started = false;
    }
    let suburbs = await Suburb.find({
      _id: {
        $in: driver_stock[0].suburb_ids,
      },
    });
    let today_start = new Date();
    today_start.setHours(0, 0, 0, 0);
    let today_end = new Date();
    today_end.setHours(23, 59, 59, 999);
    let tr_details = await StockTransfer.findOne({
      driver_id: req.payload._id,
      shift_id: coming_shift,
      type: "STOCKOUT",
      $and: [
        {
          created_at: {
            $gte: new Date(today_start),
          },
          created_at: {
            $lte: new Date(today_end),
          },
        },
      ],
    });
    let stock_details = [];
    if (tr_details) {
      stock_details = await Stock.aggregate([
        {
          $match: {
            shift_id: ObjectId(coming_shift),
            driver_id: ObjectId(req.payload._id),
            date: new Date(moment().format("YYYY-MM-DD")),
            type: "DELIVERY",
            delete_status: false,
          },
        },
        {
          $group: {
            _id: "$driver_id",
            products: {
              $push: "$products",
            },
          },
        },
        {
          $unwind: "$products",
        },
        {
          $unwind: "$products",
        },
        {
          $lookup: {
            from: "products",
            let: {
              product_id: "$products.product_id",
            },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $eq: ["$_id", "$$product_id"],
                  },
                },
              },
            ],
            as: "product_details",
          },
        },
        {
          $addFields: {
            product_details: {
              $arrayElemAt: ["$product_details", 0],
            },
          },
        },
        {
          $group: {
            _id: {
              _id: "$_id",
              product_id: "$products.product_id",
            },
            stock_total: {
              $sum: "$products.stock",
            },
            products: {
              $push: "$product_details",
            },
          },
        },
        {
          $addFields: {
            products: {
              $arrayElemAt: ["$products", 0],
            },
          },
        },
        {
          $project: {
            driver_id: "$_id._id",
            _id: "$products._id",
            cover_pic: "$products.cover_pic",
            type: "$products.type",
            name: "$products.name",
            price: "$products.price",
            description: "$products.description",
            image: "$products.image",
            is_veg: "$products.is_veg",
            allergen_contents: "$products.allergen_contents",
            ingredients: "$products.ingredients",
            container_size: "$products.container_size",
            stock: "$stock_total",
          },
        },
        {
          $group: {
            _id: "$driver_id",
            products: {
              $push: {
                _id: "$_id",
                cover_pic: "$cover_pic",
                type: "$type",
                name: "$name",
                price: "$price",
                description: "$description",
                image: "$image",
                is_veg: "$is_veg",
                allergen_contents: "$allergen_contents",
                ingredients: "$ingredients",
                container_size: "$container_size",
                stock: "$stock",
              },
            },
            total_stocks: {
              $sum: "$stock",
            },
          },
        },
        {
          $project: {
            _id: 0,
          },
        },
      ]);
      // 	stock_details = await Stock.aggregate([
      // 	{
      // 		$match: {
      // 			shift_id: ObjectId(coming_shift),
      // 			driver_id: ObjectId(req.payload._id),
      // 			date: new Date(moment().format('YYYY-MM-DD'))
      // 		}
      // 	},
      // 	{
      // 		$unwind: {
      // 			path: "$products",
      // 			preserveNullAndEmptyArrays: true
      // 		}
      // 	},
      // 	{
      // 		$lookup: {
      // 			from: "products",
      // 			let: { product_id: "$products.product_id" },
      // 			pipeline: [
      // 				{
      // 					$match: {
      // 						$expr: {
      // 							$eq: ["$$product_id", "$_id"]
      // 						}
      // 					}
      // 				},
      // 				{
      // 					$project: {
      // 						_id: 1,
      // 						cover_pic: 1,
      // 						type: 1,
      // 						name: 1,
      // 						price: 1,
      // 						description: 1,
      // 						image: 1,
      // 					}
      // 				}
      // 			],
      // 			as: "product_details"
      // 		}
      // 	},
      // 	{
      // 		$addFields: {
      // 			product_details: {
      // 				$arrayElemAt: ["$product_details", 0]
      // 			}
      // 		}
      // 	},
      // 	{
      // 		$group: {
      // 			_id: {
      // 				_id: "$_id",
      // 				boxes: "$boxes",
      // 				suburb_id: "$suburb_id",
      // 				shift_id: "$shift_id",
      // 				type: "$type",
      // 				driver_id: "$driver_id",
      // 				vehicle_id: "$vehicle_id",
      // 				date: "$date",
      // 			},
      // 			products: {
      // 				$push: {
      // 					_id: "$product_details._id",
      // 					cover_pic: "$product_details.cover_pic",
      // 					type: "$product_details.type",
      // 					name: "$product_details.name",
      // 					price: "$product_details.price",
      // 					description: "$product_details.description",
      // 					image: "$product_details.image",
      // 					stock: "$products.stock"
      // 				}
      // 			},
      // 			total_stocks: {
      // 				$sum: "$products.stock"
      // 			}
      // 		}
      // 	},
      // 	{
      // 		$project: {
      // 			_id: 0,
      // 			products: "$products",
      // 			total_stocks: "$total_stocks"
      // 		}
      // 	}
      // ])
    }

    let transfer_details = await StockTransfer.aggregate([
      {
        $match: {
          driver_id: ObjectId(req.payload._id),
          shift_id: ObjectId(coming_shift),
          type: "STOCKOUT",
          delivered_status: "PENDING",
          $and: [
            {
              created_at: {
                $gte: new Date(today_start),
              },
              // created_at: {
              // 	$lte: new Date(today_end)
              // }
            },
          ],
        },
      },
      {
        $lookup: {
          from: "drivers",
          let: {
            driver_id: "$to_driver_id",
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: ["$_id", "$$driver_id"],
                },
              },
            },
            {
              $project: {
                name: 1,
                email: 1,
                mobile: 1,
                address: 1,
                image: 1,
                location: 1,
              },
            },
          ],
          as: "driver_details",
        },
      },
      {
        $addFields: {
          driver_details: {
            $arrayElemAt: ["$driver_details", 0],
          },
        },
      },
      {
        $project: {
          driver_details: 1,
        },
      },
    ]);
    let transfer_orders = {};
    if (transfer_details.length > 0) {
      order_type = "DRIVER";
      transfer_orders = {
        _id: transfer_details[0].driver_details._id,
        name: transfer_details[0].driver_details.name,
        email: transfer_details[0].driver_details.email,
        mobile: transfer_details[0].driver_details.mobile,
        image: transfer_details[0].driver_details.image,
        location: transfer_details[0].driver_details.location,
        stock_details: stock_details,
      };
    } else {
      order_type = "ORDERS";
    }
    return res.json({
      status: true,
      data: {
        orders: outputArray,
        transfer_orders,
        suburbs,
        to_suburb: true,
        service_started,
        order_type,
      },
      // driver_stock
    });
  } catch (err) {
    console.log(err);
    return res.json({
      status: false,
      message: "Sorry something went wrong",
    });
  }
};

exports.updateFireBaseToken = async (req, res) => {
  try {
    let { errors, isValid } = ValidateDriverFirebaseToken(req.body);
    if (!isValid) {
      return res.json({
        status: false,
        message: errors[0],
      });
    }
    let { device_token } = req.body;
    await Driver.updateOne(
      {
        _id: req.payload._id,
      },
      {
        $set: {
          device_token,
        },
      }
    );
    return res.json({
      status: true,
      message: "Device token has been updated",
    });
  } catch (err) {
    console.log(err);
    return res.json({
      status: false,
      message: "Sorry something went wrong",
    });
  }
};

exports.sendPushTest = async (req, res) => {
  try {
    await SendNotificaiton(
      "Test title",
      "test body",
      "high",
      "dTdNK_Y1QFWTrqM0U4vOQD:APA91bGp4QkghvHL9u79dV-TEdrRS0SvrV00eWXcwzgd3PoZARNJz9kD7eYIEJgY-zcUScj4eUOmfMEudPQ4fEo_fzilvAOWBoRkTbqZJg8f2WNCjiWSoxw8l-fxBg8fOBuuqjr6obIv"
    );
  } catch (err) {
    console.log(err);
  }
};

exports.deliveredOrders = async (req, res) => {
  try {
    let today_start = new Date();
    today_start.setHours(0, 0, 0, 0);
    let today_end = new Date();
    today_end.setHours(23, 59, 59, 999);
    let { shifts, coming_shift } = await this.getComingShift();
    // let coming_shift = ObjectId('5f578a3a6c3b9f18f893e082')
    let delivered_orders = await Booking.aggregate([
      {
        $match: {
          redeemed: true,
          delivered_by: ObjectId(req.payload._id),
          delivered_time: {
            $gte: new Date(today_start),
          },
          // $and: [
          // 	{
          // 		delivered_time: {
          // 			$gte: new Date(today_start)
          // 		},
          // 		delivered_time: {
          // 			$lte: new Date(today_end)
          // 		}
          // 	}
          // ]
        },
      },
      {
        $lookup: {
          from: "users",
          let: {
            user_id: "$user_id",
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: ["$_id", "$$user_id"],
                },
              },
            },
            {
              $project: {
                name: 1,
                email: 1,
                mobile: 1,
                profile_pic: 1,
              },
            },
          ],
          as: "user_details",
        },
      },
      {
        $addFields: {
          user_details: {
            $arrayElemAt: ["$user_details", 0],
          },
        },
      },
      {
        $lookup: {
          from: "addresses",
          let: {
            address_id: "$address_id",
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: ["$_id", "$$address_id"],
                },
              },
            },
            {
              $project: {
                location: 1,
                address_type: 1,
                address_line1: 1,
                house_flat_no: 1,
                appartment: 1,
                landmark: 1,
                to_reach: 1,
                pincode: 1,
              },
            },
          ],
          as: "delivery_address",
        },
      },
      {
        $addFields: {
          delivery_address: {
            $arrayElemAt: ["$delivery_address", 0],
          },
        },
      },
      {
        $lookup: {
          from: "products",
          let: {
            products: "$orders",
          },
          pipeline: [
            {
              $addFields: {
                products: "$$products",
              },
            },
            {
              $unwind: "$products",
            },
            {
              $match: {
                $expr: {
                  $eq: ["$_id", "$products.product_id"],
                },
              },
            },
            {
              $project: {
                cover_pic: 1,
                type: 1,
                name: 1,
                description: 1,
                image: 1,
                is_veg: 1,
                price: "$products.price",
                quantity: "$products.quantity",
              },
            },
          ],
          as: "orders",
        },
      },
      {
        $project: {
          _id: 1,
          booking_type: 1,
          created_at: 1,
          booking_id: 1,
          scheduled_date: 1,
          orders: 1,
          delivered_as: 1,
          delivered_time: 1,
          user_details: 1,
          delivery_address: 1,
        },
      },
      {
        $sort: {
          delivered_time: -1,
        },
      },
    ]);
    return res.json({
      status: true,
      data: delivered_orders,
    });
  } catch (err) {
    console.log(err);
    return res.json({
      status: false,
      message: "Sorry something went wrong",
    });
  }
};

exports.scheduledOrderList = async (req, res) => {
  try {
    let { shifts, coming_shift } = await this.getComingShift();
    // let coming_shift = ObjectId('5f578a3a6c3b9f18f893e082')
    let stocks = await Stock.aggregate([
      {
        $match: {
          driver_id: ObjectId(req.payload._id),
          type: "DELIVERY",
          delete_status: false,
          shift_id: coming_shift,
          date: new Date(moment().format("YYYY-MM-DD")),
        },
      },
      {
        $group: {
          _id: null,
          suburb_ids: {
            $push: "$suburb_id",
          },
        },
      },
    ]);
    if (stocks.length > 0) {
      suburb_ids = stocks[0].suburb_ids;
    } else {
      suburb_ids = [];
    }
    let bookings = await Booking.aggregate([
      {
        $match: {
          booking_type: "SCHEDULED",
          delivery_type: "ONLINE",
          scheduled_date: new Date(moment().format("YYYY-MM-DD")),
          shift_id: ObjectId(coming_shift),
          redeemed: false,
          delete_status: false,
        },
      },
      {
        $lookup: {
          from: "addresses",
          let: {
            address_id: "$address_id",
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    {
                      $eq: ["$_id", "$$address_id"],
                    },
                    {
                      $in: ["$suburb_id", suburb_ids],
                    },
                  ],
                },
              },
            },
            {
              $project: {
                location: 1,
                address_type: 1,
                address_line1: 1,
                house_flat_no: 1,
                appartment: 1,
                landmark: 1,
                to_reach: 1,
                contact_person: 1,
              },
            },
          ],
          as: "address",
        },
      },
      {
        $unwind: "$address",
      },
      // {
      // 	$addFields: {
      // 		address: {
      // 			$arrayElemAt: ["$address", 0]
      // 		}
      // 	}
      // },
      {
        $lookup: {
          from: "products",
          let: {
            products: "$orders",
          },
          pipeline: [
            {
              $addFields: {
                products: "$$products",
              },
            },
            {
              $unwind: "$products",
            },
            {
              $match: {
                $expr: {
                  $eq: ["$_id", "$products.product_id"],
                },
              },
            },
            {
              $project: {
                cover_pic: 1,
                type: 1,
                name: 1,
                description: 1,
                image: 1,
                is_veg: 1,
                allergen_contents: 1,
                quantity: "$products.quantity",
                price: "$products.price",
              },
            },
          ],
          as: "products",
        },
      },
      {
        $project: {
          booking_type: 1,
          booking_id: 1,
          delivery_type: 1,
          scheduled_date: 1,
          products: 1,
          address: 1,
        },
      },
    ]);
    return res.json({
      status: true,
      data: bookings,
    });
  } catch (err) {
    console.log(err);
    return res.json({
      status: false,
      message: "Sorry something went wrong",
    });
  }
};

exports.confirmJob = async (req, res) => {
  let { job_id, approved } = req.body;
  let driver = req.payload._id;
  try {
    let notification = await JobNotification.findOne({ _id: ObjectId(job_id) });
    if (!notification) {
      throw new Error("No notification found");
    }

    let title = "approved";
    if (approved == "true") {
      await JobNotification.updateOne(
        {
          _id: ObjectId(job_id),
        },
        {
          $addToSet: {
            accepted_drivers: ObjectId(driver),
          },
          $pull: { rejected_drivers: ObjectId(driver) },
        }
      );
    } else {
      await JobNotification.updateOne(
        {
          _id: ObjectId(job_id),
        },
        {
          $addToSet: {
            rejected_drivers: ObjectId(driver),
          },
          $pull: { accepted_drivers: ObjectId(driver) },
        }
      );
      title = "rejected";
    }
    return res.json({
      status: true,
      message: `The job is ${title} successfully!`,
    });
  } catch (err) {
    console.log(err);
    return res.json({
      status: false,
      message: "Could not confirm the job request",
    });
  }
};

exports.listjobs = async (req, res) => {
  let { page, limit } = req.query;
  let skip = 0;
  if (typeof limit === "undefined") limit = 10;
  if (typeof page === "undefined") page = 1;
  if (page > 1) {
    skip = (page - 1) * limit;
  }
  let driver = req.payload._id;
  try {
    const JobNotification = mongoose.model("job_notifications");
    let notifications = await JobNotification.aggregate([
      {
        $match: {
          delete_status: false,
          date: {
            $gte: new Date(moment().format("YYYY-MM-DD")),
          },
        },
      },
      {
        $lookup: {
          from: "settings",
          let: {
            shift_id: "$shift_id",
          },
          pipeline: [
            {
              $unwind: "$shift_times",
            },
            {
              $match: {
                $expr: {
                  $and: [{ $eq: ["$shift_times._id", "$$shift_id"] }],
                },
              },
            },
            {
              $project: {
                _id: "$shift_times._id",
                name: "$shift_times.name",
                duration: "$shift_times.duration",
                time: "$shift_times.time",
              },
            },
          ],
          as: "shift",
        },
      },
      {
        $addFields: {
          shift: {
            $arrayElemAt: ["$shift", 0],
          },
        },
      },
      {
        $addFields: {
          accept_status: {
            $cond: {
              if: {
                $in: [ObjectId(driver), "$accepted_drivers"],
              },
              then: true,
              else: false,
            },
          },
        },
      },
      {
        $addFields: {
          reject_status: {
            $cond: {
              if: {
                $in: [ObjectId(driver), "$rejected_drivers"],
              },
              then: true,
              else: false,
            },
          },
        },
      },
      // {
      // 	$match: {
      // 		reject_status: false
      // 	}
      // },
      {
        $project: {
          _id: 1,
          date: 1,
          shift_id: 1,
          shift_name: "$shift.name",
          created_at: 1,
          accept_status: 1,
          reject_status: 1,
        },
      },
      {
        $sort: {
          created_at: -1,
        },
      },
      {
        $skip: skip,
      },
      {
        $limit: limit,
      },
    ]);

    return res.json({
      status: true,
      data: {
        lists: notifications,
        page,
      },
    });
  } catch (err) {
    console.log(err);
    return res.json({
      status: false,
      message: "Some thing went wrong",
      data: {},
    });
  }
};

exports.tripDetails = async (req, res) => {
  try {
    let { from_date, to_date } = req.query;
    if (from_date) {
      from_date = new Date(moment(from_date).format("YYYY-MM-DD"));
    } else {
      from_date = new Date(moment().format("YYYY-MM-DD"));
    }
    if (to_date) {
      to_date = new Date(moment(to_date).format("YYYY-MM-DD"));
    } else {
      to_date = new Date(moment().format("YYYY-MM-DD"));
    }
    let query = [
      {
        $match: {
          delivered_by: ObjectId(req.payload._id),
          $and: [
            {
              scheduled_date: {
                $gte: from_date,
              },
            },
            {
              scheduled_date: {
                $lte: to_date,
              },
            },
          ],
        },
      },
      {
        $count: "trips",
      },
    ];
    let trip_details = await Booking.aggregate(query);
    if (trip_details.length > 0) {
      deliveries = trip_details[0].trips;
    } else {
      deliveries = 0;
    }

    // hours calculation
    let driver_logs = await DriverLog.aggregate([
      {
        $match: {
          driver_id: ObjectId(req.payload._id),
          $and: [
            {
              date: {
                $gte: from_date,
              },
            },
            {
              date: {
                $lte: to_date,
              },
            },
          ],
        },
      },
      {
        $addFields: {
          total_time: {
            $divide: [
              {
                $subtract: ["$service_end_time", "$service_start_time"],
              },
              1000 * 60,
            ],
          },
          active_hrs: {
            $divide: [
              {
                $subtract: ["$service_end_time", "$dedicated_start_time"],
              },
              1000 * 60,
            ],
          },
          inactive_hrs: {
            $add: [
              {
                $divide: [
                  {
                    $subtract: ["$dedicated_start_time", "$service_start_time"],
                  },
                  1000 * 60,
                ],
              },
              {
                $divide: [
                  {
                    $subtract: ["$service_end_time", "$callback_time"],
                  },
                  1000 * 60,
                ],
              },
            ]
          },
        },
      },
      {
        $group: {
          _id: "$driver_id",
          total_hours: {
            $sum: "$total_time",
          },
          active_hours: {
            $sum: "$active_hrs",
          },
          inactive_hours: {
            $sum: "$inactive_hrs",
          },
        },
      },
      {
        $addFields: {
          total_hours: {
            $concat: [
              {
                $toString: {
                  $concat: [
                    {
                      $toString: {
                        $floor: {
                          $divide: ["$total_hours", 60]
                        }
                      }
                    },
                    "Hrs "
                  ]
                }
              },
              {
                $toString: {
                  $concat: [
                    {
                      $toString:{
                        $floor:{
                          $mod: ["$total_hours", 60]
                        }
                      }
                    },
                    "Mnts"
                  ]
                }
              }
            ]
          },
          active_hours: {
            $concat: [
              {
                $toString: {
                  $concat: [
                    {
                      $toString: {
                        $floor: {
                          $divide: ["$active_hours", 60]
                        }
                      }
                    },
                    "Hrs "
                  ]
                }
              },
              {
                $toString: {
                  $concat: [
                    {
                      $toString:{
                        $floor:{
                          $mod: ["$active_hours", 60]
                        }
                      }
                    },
                    "Mnts"
                  ]
                }
              }
            ]
          },
          inactive_hours: {
            $concat: [
              {
                $toString: {
                  $concat: [
                    {
                      $toString: {
                        $floor: {
                          $divide: ["$inactive_hours", 60]
                        }
                      }
                    },
                    "Hrs "
                  ]
                }
              },
              {
                $toString: {
                  $concat: [
                    {
                      $toString:{
                        $floor:{
                          $mod: ["$inactive_hours", 60]
                        }
                      }
                    },
                    "Mnts"
                  ]
                }
              }
            ]
          }
        },
      }
    ]);
    let data = {
      deliveries,
      total_hours: driver_logs[0].total_hours,
      active_hours: driver_logs[0].active_hours,
      inactive_hours: driver_logs[0].inactive_hours,
    };
    return res.json({
      status: true,
      data,
    });
  } catch (err) {
    console.log(err);
    return res.json({
      status: false,
      message: "Sorry somethign went wrong",
    });
  }
};

exports.markTransferred = async (req, res) => {
  try {
    let { to_driver_id } = req.body;
    if (typeof to_driver_id === "undefined") {
      return res.json({
        status: false,
        message: "Driver id is required",
      });
    }
    let { shifts, coming_shift } = await this.getComingShift();
    // let coming_shift = ObjectId('5f578a2a6c3b9f18f893e081')
    let stock_transfer = await StockTransfer.findOne({
      type: "STOCKOUT",
      driver_id: req.payload._id,
      to_driver_id: to_driver_id,
      shift_id: coming_shift,
      created_at: {
        $gte: new Date(moment().format("YYYY-MM-DD")),
      },
    });
    await StockTransfer.updateOne(
      {
        type: "STOCKOUT",
        driver_id: req.payload._id,
        to_driver_id: to_driver_id,
        shift_id: coming_shift,
        created_at: {
          $gte: new Date(moment().format("YYYY-MM-DD")),
        },
      },
      {
        delivered_status: "TRANSFERRED",
        transferred_at: Date.now(),
      }
    );
    let to_driver_details = await Driver.findOne({
      _id: to_driver_id,
    });
    (title = "Order Transferred"),
      (description = "Order has been transfered from driver"),
      (token = to_driver_details.device_token);
    await SendNotificaiton(title, description, "high", token);
    let driver_notification = new DriverNotification({
      title: "Order Transferred",
      description: "Order has been transfered from driver",
      type: "FOOD_TRANSFER_REQUEST",
      driver_id: to_driver_id,
      stock_transfer_id: stock_transfer._id,
    });
    await driver_notification.save();
    return res.json({
      status: true,
      message: "Order transferred successfully",
    });
  } catch (err) {
    console.log(err);
    return res.json({
      status: false,
      message: "Sorry something went wrong",
    });
  }
};

exports.getNotifications = async (req, res) => {
  try {
    let { shifts, coming_shift } = await this.getComingShift();
    // let coming_shift = ObjectId('5f5af9a49030860f71205e09')
    let { page, limit } = req.query;
    let skip = 0;
    if (typeof limit === "undefined") limit = 5;
    if (typeof page === "undefined") page = 1;
    if (page > 1) {
      skip = (page - 1) * limit;
    }
    let query = [
      {
        $match: {
          driver_id: ObjectId(req.payload._id),
        },
      },
      {
        $lookup: {
          from: "stock_transfers",
          let: {
            stock_transfer_id: "$stock_transfer_id",
          },
          pipeline: [
            {
              $match: {
                // delivered_status: {
                // 	$ne: 'RECEIVED'
                // },
                $expr: {
                  $eq: ["$_id", "$$stock_transfer_id"],
                },
              },
            },
            {
              $project: {
                delivered_status: 1,
                transferred_at: 1,
                driver_id: 1,
                shift_id: 1,
                products: 1,
                created_at: 1,
                date: 1,
              },
            },
          ],
          as: "stock_transfer",
        },
      },
      {
        $addFields: {
          stock_transfer: {
            $arrayElemAt: ["$stock_transfer", 0],
          },
        },
      },
      {
        $project: {
          created_at: 1,
          title: 1,
          description: 1,
          type: 1,
          stock_transfer_id: 1,
          delivered_status: "$stock_transfer.delivered_status",
          transferred_at: "$stock_transfer.transferred_at",
          from_driver_id: "$stock_transfer.driver_id",
          shift_id: "$stock_transfer.shift_id",
          date: "$stock_transfer.date",
          stock_details: "$stock_transfer.products",
        },
      },
      {
        $lookup: {
          from: "drivers",
          let: {
            driver_id: "$from_driver_id",
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: ["$_id", "$$driver_id"],
                },
              },
            },
            {
              $project: {
                _id: 1,
                name: 1,
                email: 1,
                mobile: 1,
                image: 1,
                location: 1,
              },
            },
          ],
          as: "from_driver",
        },
      },
      {
        $addFields: {
          from_driver: {
            $arrayElemAt: ["$from_driver", 0],
          },
        },
      },
      {
        $lookup: {
          from: "products",
          let: {
            products: "$stock_details",
          },
          pipeline: [
            {
              $addFields: {
                products: "$$products",
              },
            },
            {
              $unwind: "$products",
            },
            {
              $match: {
                $expr: {
                  $eq: ["$_id", "$products.product_id"],
                },
              },
            },
            {
              $project: {
                _id: 1,
                cover_pic: 1,
                type: 1,
                name: 1,
                price: 1,
                description: 1,
                image: 1,
                is_veg: 1,
                allergen_contents: 1,
                ingredients: 1,
                container_size: 1,
                stock: "$products.stock",
              },
            },
            {
              $group: {
                _id: null,
                products: {
                  $push: "$$ROOT",
                },
                total_stocks: {
                  $sum: "$stock",
                },
              },
            },
          ],
          as: "stock_details",
        },
      },
      {
        $sort: {
          _id: -1,
        },
      },
    ];
    let notifications = await DriverNotification.aggregate([
      ...query,
      {
        $skip: skip,
      },
      {
        $limit: limit,
      },
    ]);
    let itemCount = await DriverNotification.aggregate([
      ...query,
      {
        $count: "count",
      },
    ]);
    if (itemCount.length > 0) {
      itemCount = itemCount[0].count;
    } else {
      itemCount = 0;
    }
    const pageCount = Math.ceil(itemCount / limit);
    let data = {
      notifications,
      itemCount,
      pageCount,
      pages: paginate.getArrayPages(req)(5, pageCount, page),
      activePage: page,
    };
    return res.json({
      status: true,
      data,
    });
  } catch (err) {
    console.log(err);
    return res.json({
      status: false,
      message: "Sorry something went wrong",
    });
  }
};

// exports.getNotifications = async (req, res) => {
// 	try {
// 		let { shifts, coming_shift } = await this.getComingShift()
// 		// let coming_shift = ObjectId('5f5af9a49030860f71205e09')
// 		let { page, limit } = req.query
// 		let skip = 0
// 		if (typeof limit === "undefined") limit = 5
// 		if (typeof page === "undefined") page = 1
// 		if (page > 1) {
// 			skip = (page - 1) * limit
// 		}
// 		let query = [
// 			{
// 				$match: {
// 					driver_id: ObjectId(req.payload._id),
// 				}
// 			},
// 			{
// 				$lookup: {
// 					from: 'stock_transfers',
// 					let: {
// 						stock_transfer_id: "$stock_transfer_id"
// 					},
// 					pipeline: [
// 						{
// 							$match: {
// 								delivered_status: {
// 									$ne: 'RECEIVED'
// 								},
// 								$expr: {
// 									$eq: ["$_id", "$$stock_transfer_id"]
// 								}
// 							}
// 						},
// 						{
// 							$project: {
// 								delivered_status: 1,
// 								transferred_at: 1,
// 								driver_id: 1,
// 								shift_id: 1,
// 								created_at: 1,
// 								date: 1,
// 							}
// 						}
// 					],
// 					as: "stock_transfer"
// 				}
// 			},
// 			{
// 				$addFields: {
// 					stock_transfer: {
// 						$arrayElemAt: ["$stock_transfer", 0]
// 					}
// 				}
// 			},
// 			{
// 				$project: {
// 					created_at: 1,
// 					title: 1,
// 					description: 1,
// 					type: 1,
// 					stock_transfer_id: 1,
// 					delivered_status: "$stock_transfer.delivered_status",
// 					transferred_at: "$stock_transfer.transferred_at",
// 					from_driver_id: "$stock_transfer.driver_id",
// 					shift_id: "$stock_transfer.shift_id",
// 					date: "$stock_transfer.date"
// 				}
// 			},
// 			{
// 				$lookup: {
// 					from: 'stocks',
// 					let: {
// 						shift_id: "$shift_id",
// 						driver_id: "$from_driver_id",
// 						date: "$date"
// 					},
// 					pipeline: [
// 						{
// 							$match: {
// 								// date: new Date("$$date"),
// 								type: 'DELIVERY',
// 								delete_status: false,
// 								$expr: {
// 									$and: [
// 										{
// 											$eq: ["$shift_id", "$$shift_id"]
// 										},
// 										{
// 											$eq: ["$driver_id", "$$driver_id"]
// 										},
// 										{
// 											$eq: ["$date", "$$date"]
// 										}
// 									]
// 								}
// 							}
// 						},
// 						{
// 							$group: {
// 								_id: "$driver_id",
// 								products: {
// 									$push: "$products"
// 								}
// 							}
// 						},
// 						{
// 							$unwind: "$products"
// 						},
// 						{
// 							$unwind: "$products"
// 						},
// 						{
// 							$lookup: {
// 								from: 'products',
// 								let: {
// 									product_id: '$products.product_id'
// 								},
// 								pipeline: [
// 									{
// 										$match: {
// 											$expr: {
// 												$eq: ["$_id", "$$product_id"]
// 											}
// 										}
// 									}
// 								],
// 								as: 'product_details'
// 							}
// 						},
// 						{
// 							$addFields: {
// 								product_details: {
// 									$arrayElemAt: ["$product_details", 0]
// 								}
// 							}
// 						},
// 						{
// 							$group: {
// 								_id: {
// 									_id: "$_id",
// 									product_id: "$products.product_id"
// 								},
// 								stock_total: {
// 									$sum: "$products.stock"
// 								},
// 								products: {
// 									$push: "$product_details"
// 								}
// 							}
// 						},
// 						{
// 							$addFields: {
// 								products: {
// 									$arrayElemAt: ["$products", 0]
// 								}
// 							}
// 						},
// 						{
// 							$project: {
// 								driver_id: "$_id._id",
// 								_id: "$products._id",
// 								cover_pic: "$products.cover_pic",
// 								type: "$products.type",
// 								name: "$products.name",
// 								price: "$products.price",
// 								description: "$products.description",
// 								image: "$products.image",
// 								is_veg: "$products.is_veg",
// 								allergen_contents: "$products.allergen_contents",
// 								ingredients: "$products.ingredients",
// 								container_size: "$products.container_size",
// 								stock: "$stock_total",
// 							}
// 						},
// 						{
// 							$group: {
// 								_id: "$driver_id",
// 								products: {
// 									$push: {
// 										_id: "$_id",
// 										cover_pic: "$cover_pic",
// 										type: "$type",
// 										name: "$name",
// 										price: "$price",
// 										description: "$description",
// 										image: "$image",
// 										is_veg: "$is_veg",
// 										allergen_contents: "$allergen_contents",
// 										ingredients: "$ingredients",
// 										container_size: "$container_size",
// 										stock: "$stock",
// 									}
// 								},
// 								total_stocks: {
// 									$sum: "$stock"
// 								}
// 							}
// 						},
// 						{
// 							$project: {
// 								_id: 0
// 							}
// 						}
// 					],
// 					as: 'stock_details'
// 				}
// 			},
// 			{
// 				$lookup: {
// 					from: "drivers",
// 					let: {
// 						driver_id: "$from_driver_id"
// 					},
// 					pipeline: [
// 						{
// 							$match: {
// 								$expr: {
// 									$eq: ["$_id", "$$driver_id"]
// 								}
// 							}
// 						},
// 						{
// 							$project: {
// 								_id: 1,
// 								name: 1,
// 								email: 1,
// 								mobile: 1,
// 								image: 1,
// 								location: 1,
// 							}
// 						}
// 					],
// 					as: 'from_driver'
// 				}
// 			},
// 			{
// 				$addFields: {
// 					from_driver: {
// 						$arrayElemAt: ["$from_driver", 0]
// 					}
// 				}
// 			},
// 			{
// 				$sort: {
// 					_id: -1
// 				}
// 			}
// 		]
// 		let notifications = await DriverNotification.aggregate([...query, {
// 			$skip: skip
// 		}, {
// 			$limit: limit
// 		}])
// 		let itemCount = await DriverNotification.aggregate([...query, {
// 			$count: "count"
// 		}])
// 		if (itemCount.length > 0) {
// 			itemCount = itemCount[0].count
// 		} else {
// 			itemCount = 0
// 		}
// 		const pageCount = Math.ceil(itemCount / limit)
// 		let data = {
// 			notifications,
// 			itemCount,
// 			pageCount,
// 			pages: paginate.getArrayPages(req)(5, pageCount, page),
// 			activePage: page,
// 		}
// 		return res.json({
// 			status: true,
// 			data
// 		})
// 	} catch (err) {
// 		console.log(err)
// 		return res.json({
// 			status: false,
// 			message: 'Sorry something went wrong'
// 		})
// 	}
// }

exports.markReceived = async (req, res) => {
  try {
    let { stock_transfer_id } = req.body;
    let { shifts, coming_shift } = await this.getComingShift();
    // let coming_shift = ObjectId('5f5af9a49030860f71205e09')
    if (typeof stock_transfer_id === "undefined") {
      return res.json({
        status: false,
        message: "Stock transfer id is required",
      });
    }
    stock_transfer_details = await StockTransfer.findOne({
      _id: stock_transfer_id,
    });
    let my_stock = await Stock.findOne(
      {
        shift_id: ObjectId(coming_shift),
        date: new Date(moment().format("YYYY-MM-DD")),
        driver_id: ObjectId(req.payload._id),
      },
      {
        products: 1,
      }
    );
    let product_array = [];
    let box_ids = [];
    for (var i = 0; i < my_stock.products.length; i++) {
      let details = {
        _id: my_stock.products[i].product_id,
        stock: my_stock.products[i].stock,
        my_box_id: my_stock.products[i].box_id,
      };
      product_array.push(details);
      box_ids.push(my_stock.products[i].box_id);
    }
    let coming_stock = await Stock.aggregate([
      {
        $match: {
          shift_id: ObjectId(stock_transfer_details.shift_id),
          driver_id: ObjectId(stock_transfer_details.driver_id),
          date: stock_transfer_details.date,
          type: "DELIVERY",
          delete_status: false,
        },
      },
      {
        $group: {
          _id: "$driver_id",
          products: {
            $push: "$products",
          },
        },
      },
      {
        $unwind: "$products",
      },
      {
        $unwind: "$products",
      },
      {
        $lookup: {
          from: "products",
          let: {
            product_id: "$products.product_id",
            box_id: "$products.box_id",
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: ["$_id", "$$product_id"],
                },
              },
            },
            {
              $addFields: {
                box_id: "$$box_id",
              },
            },
          ],
          as: "product_details",
        },
      },
      {
        $addFields: {
          product_details: {
            $arrayElemAt: ["$product_details", 0],
          },
        },
      },
      {
        $group: {
          _id: {
            _id: "$_id",
            product_id: "$products.product_id",
          },
          stock_total: {
            $sum: "$products.stock",
          },
          products: {
            $push: "$product_details",
          },
        },
      },
      {
        $addFields: {
          products: {
            $arrayElemAt: ["$products", 0],
          },
        },
      },
      {
        $project: {
          driver_id: "$_id._id",
          _id: "$products._id",
          cover_pic: "$products.cover_pic",
          type: "$products.type",
          name: "$products.name",
          price: "$products.price",
          description: "$products.description",
          image: "$products.image",
          is_veg: "$products.is_veg",
          allergen_contents: "$products.allergen_contents",
          ingredients: "$products.ingredients",
          container_size: "$products.container_size",
          box_id: "$products.box_id",
          stock: "$stock_total",
        },
      },
      {
        $group: {
          _id: "$driver_id",
          products: {
            $push: {
              _id: "$_id",
              stock: "$stock",
              box_id: "$box_id",
            },
          },
        },
      },
      {
        $project: {
          _id: 0,
        },
      },
      {
        $addFields: {
          product_array: product_array,
        },
      },
      {
        $project: {
          products: {
            $concatArrays: ["$products", "$product_array"],
          },
        },
      },
      {
        $unwind: "$products",
      },
      {
        $group: {
          _id: "$products._id",
          stock: {
            $sum: "$products.stock",
          },
        },
      },
    ]);
    let products = [];
    for (var i = 0; i < coming_stock.length; i++) {
      let obj = {
        product_id: coming_stock[i]._id,
        stock: coming_stock[i].stock,
        box_id: box_ids[Math.floor(Math.random() * Math.floor(box_ids.length))],
      };
      products.push(obj);
    }
    (my_stock.products = products), await my_stock.save(); // updatng stock count
    // push notification as stock updated

    // remove stocks from from_driver
    await Stock.updateMany(
      {
        shift_id: stock_transfer_details.shift_id,
        driver_id: stock_transfer_details.driver_id,
        date: stock_transfer_details.date,
        type: "DELIVERY",
        delete_status: false,
        // products: {
        // 	$elemMatch: {
        // 		stock: {
        // 			$gt: 0
        // 		}
        // 	}
        // }
      },
      {
        $set: {
          "products.$[].stock": 0,
        },
      }
    );
    // stop service of from driver
    await DriverLog.updateOne(
      {
        date: new Date(moment().format("YYYY-MM-DD")),
        driver_id: stock_transfer_details.driver_id,
        shift_id: stock_transfer_details.shift_id,
      },
      {
        $set: {
          service_end_time: Date.now(),
        },
      }
    );
    // push notification as service stopped
    from_driver_details = await Driver.findOne({
      _id: stock_transfer_details.driver_id,
    });
    (title = "Service ended"),
      (description = "Your service for the shift has been ended");

    await SendNotificaiton(
      title,
      description,
      "high",
      from_driver_details.device_token
    );
    // Mark stock received in stock transfer table
    stock_transfer_details.delivered_status = "RECEIVED";
    stock_transfer_details.received_at = Date.now();
    await stock_transfer_details.save();
    return res.json({
      status: true,
      message: "Stock received",
    });
  } catch (err) {
    console.log(err);
    return res.json({
      status: false,
      message: "Sorry something went wrong",
    });
  }
};

exports.logoutDriver = async (req, res) => {
  try {
    let driver = await Driver.findOne({ _id: req.payload._id });
    let isBookings = await BookingSlot.countDocuments({
      driver_id: req.payload._id
    })
    if (isBookings > 0) {
      return res.json({
        status: false,
        message: 'Complete allocated orders to logout'
      })
    }
    if (driver) {
      driver.device_token = null;
      await driver.save();
      return res.json({
        status: true,
        message: "Logout successfully",
      });
    } else {
      return res.json({
        status: false,
        message: "Driver not found",
      });
    }
  } catch (err) {
    console.log(err);
    return res.json({
      status: false,
      message: err.message,
    });
  }
};

exports.OrderNew = async (req, res) => {
  try {
    let { shifts, coming_shift } = await this.getComingShift();
    let driver_stock = await Stock.aggregate([
      {
        $match: {
          date: new Date(moment().format("YYYY-MM-DD")),
          shift_id: ObjectId(coming_shift),
          driver_id: ObjectId(req.payload._id),
        },
      },
      {
        $group: {
          _id: null,
          suburb_ids: {
            $push: "$suburb_id",
          },
        },
      },
    ]);
    if (driver_stock.length == 0) {
      return res.json({
        status: false,
        message: "No stock allocated for you please contact admin",
      });
    }
    let driver_log = await DriverLog.findOne({
      driver_id: req.payload._id,
      shift_id: coming_shift,
      date: new Date(moment().format("YYYY-MM-DD")),
    });
    var to_suburb = true;
    if (driver_log && driver_log.dedicated_start_time == null) {
      to_suburb = false;
    }
    if (
      driver_log &&
      driver_log.service_start_time &&
      driver_log.service_end_time == null
    ) {
      service_started = true;
    } else {
      service_started = false;
    }
    let suburbs = await Suburb.find({
      _id: {
        $in: driver_stock[0].suburb_ids,
      },
    });
    let today_start = new Date();
    today_start.setHours(0, 0, 0, 0);
    let today_end = new Date();
    today_end.setHours(23, 59, 59, 999);
    let tr_details = await StockTransfer.findOne({
      driver_id: req.payload._id,
      shift_id: coming_shift,
      type: "STOCKOUT",
      $and: [
        {
          created_at: {
            $gte: new Date(today_start),
          },
          created_at: {
            $lte: new Date(today_end),
          },
        },
      ],
    });
    let stock_details = [];
    if (tr_details) {
      stock_details = await Stock.aggregate([
        {
          $match: {
            shift_id: ObjectId(coming_shift),
            driver_id: ObjectId(req.payload._id),
            date: new Date(moment().format("YYYY-MM-DD")),
            type: "DELIVERY",
            delete_status: false,
          },
        },
        {
          $group: {
            _id: "$driver_id",
            products: {
              $push: "$products",
            },
          },
        },
        {
          $unwind: "$products",
        },
        {
          $unwind: "$products",
        },
        {
          $lookup: {
            from: "products",
            let: {
              product_id: "$products.product_id",
            },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $eq: ["$_id", "$$product_id"],
                  },
                },
              },
            ],
            as: "product_details",
          },
        },
        {
          $addFields: {
            product_details: {
              $arrayElemAt: ["$product_details", 0],
            },
          },
        },
        {
          $group: {
            _id: {
              _id: "$_id",
              product_id: "$products.product_id",
            },
            stock_total: {
              $sum: "$products.stock",
            },
            products: {
              $push: "$product_details",
            },
          },
        },
        {
          $addFields: {
            products: {
              $arrayElemAt: ["$products", 0],
            },
          },
        },
        {
          $project: {
            driver_id: "$_id._id",
            _id: "$products._id",
            cover_pic: "$products.cover_pic",
            type: "$products.type",
            name: "$products.name",
            price: "$products.price",
            description: "$products.description",
            image: "$products.image",
            is_veg: "$products.is_veg",
            allergen_contents: "$products.allergen_contents",
            ingredients: "$products.ingredients",
            container_size: "$products.container_size",
            stock: "$stock_total",
          },
        },
        {
          $group: {
            _id: "$driver_id",
            products: {
              $push: {
                _id: "$_id",
                cover_pic: "$cover_pic",
                type: "$type",
                name: "$name",
                price: "$price",
                description: "$description",
                image: "$image",
                is_veg: "$is_veg",
                allergen_contents: "$allergen_contents",
                ingredients: "$ingredients",
                container_size: "$container_size",
                stock: "$stock",
              },
            },
            total_stocks: {
              $sum: "$stock",
            },
          },
        },
        {
          $project: {
            _id: 0,
          },
        },
      ]);
    }

    let transfer_details = await StockTransfer.aggregate([
      {
        $match: {
          driver_id: ObjectId(req.payload._id),
          shift_id: ObjectId(coming_shift),
          type: "STOCKOUT",
          delivered_status: "PENDING",
          $and: [
            {
              created_at: {
                $gte: new Date(today_start),
              },
            },
          ],
        },
      },
      {
        $lookup: {
          from: "drivers",
          let: {
            driver_id: "$to_driver_id",
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: ["$_id", "$$driver_id"],
                },
              },
            },
            {
              $project: {
                name: 1,
                email: 1,
                mobile: 1,
                address: 1,
                image: 1,
                location: 1,
              },
            },
          ],
          as: "driver_details",
        },
      },
      {
        $addFields: {
          driver_details: {
            $arrayElemAt: ["$driver_details", 0],
          },
        },
      },
      {
        $project: {
          driver_details: 1,
        },
      },
    ]);
    let transfer_orders = {};
    if (transfer_details.length > 0) {
      order_type = "DRIVER";
      transfer_orders = {
        _id: transfer_details[0].driver_details._id,
        name: transfer_details[0].driver_details.name,
        email: transfer_details[0].driver_details.email,
        mobile: transfer_details[0].driver_details.mobile,
        image: transfer_details[0].driver_details.image,
        location: transfer_details[0].driver_details.location,
        stock_details: stock_details,
      };
    } else {
      order_type = "ORDERS";
    }
    let start_date = new Date(moment().format('YYYY-MM-DD 00:00:000'))
    let end_date = new Date(moment().format('YYYY-MM-DD 23:59'))
    let orders = await BookingSlot.aggregate([
      {
        $match: {
          driver_id: ObjectId(req.payload._id),
          // shift_id: ObjectId(coming_shift),
          // date: new Date(moment().format("YYYY-MM-DD")),
          $and: [
            {
              date: {
                $gte: start_date
              }
            },
            {
              date: {
                $lte: end_date
              }
            }
          ]
        },
      },
      {
        $lookup: {
          from: "bookings",
          let: {
            booking_id: "$booking_id",
            distance: "$distance",
          },
          pipeline: [
            {
              $match: {
                redeemed: false,
                scheduled_date: new Date(moment().format("YYYY-MM-DD")),
                $expr: {
                  $eq: ["$$booking_id", "$_id"],
                },
              },
            },
            {
              $lookup: {
                from: "addresses",
                let: {
                  address_id: "$address_id",
                },
                pipeline: [
                  {
                    $match: {
                      $expr: {
                        $eq: ["$_id", "$$address_id"],
                      },
                    },
                  },
                  {
                    $project: {
                      updated_at: 0,
                      delete_status: 0,
                      user_id: 0,
                      __v: 0,
                    },
                  },
                ],
                as: "delivery_address",
              },
            },
            {
              $addFields: {
                delivery_address: {
                  $arrayElemAt: ["$delivery_address", 0],
                },
              },
            },
            {
              $lookup: {
                from: "users",
                let: {
                  user_id: "$user_id",
                },
                pipeline: [
                  {
                    $match: {
                      $expr: {
                        $eq: ["$_id", "$$user_id"],
                      },
                    },
                  },
                  {
                    $project: {
                      _id: 1,
                      profile_pic: 1,
                      name: 1,
                      email: 1,
                      mobile: {
                        $concat: ["0", "$mobile"],
                      },
                    },
                  },
                ],
                as: "user_details",
              },
            },
            {
              $addFields: {
                user_details: {
                  $arrayElemAt: ["$user_details", 0],
                },
              },
            },
            {
              $lookup: {
                from: "products",
                let: {
                  products: "$orders",
                },
                pipeline: [
                  {
                    $addFields: {
                      products: "$$products",
                    },
                  },
                  {
                    $unwind: "$products",
                  },
                  {
                    $match: {
                      $expr: {
                        $eq: ["$_id", "$products.product_id"],
                      },
                    },
                  },
                  {
                    $project: {
                      cover_pic: 1,
                      type: 1,
                      name: 1,
                      description: 1,
                      image: 1,
                      is_veg: 1,
                      price: "$products.price",
                      quantity: "$products.quantity",
                    },
                  },
                ],
                as: "products",
              },
            },
          ],
          as: "orders",
        },
      },
      {
        $addFields: {
          orders: {
            $arrayElemAt: ["$orders", 0],
          },
        },
      },
      {
        $project: {
          date: 0,
          driver_id: 0,
          booking_id: 0,
          address_id: 0,
          shift_id: 0,
          _id: 0,
          location: 0,
          __v: 0,
        },
      },
      {
        $sort: {
          order: -1,
          distance: 1,
        },
      },
      {
        $project: {
          _id: "$orders._id",
          booking_type: "$orders.booking_type",
          created_at: "$orders.created_at",
          booking_id: "$orders.booking_id",
          delivery_address: "$orders.delivery_address",
          products: "$orders.products",
          user_details: "$orders.user_details",
          distance: "$distance",
          order: "$order"
        },
      },
    ]);
    // return res.json({
    // 	orders
    // })
    if (orders.length > 0) {
      let booking_details = await Booking.findOne({
        _id: orders[0]._id
      })
      let order_lat = orders[0].delivery_address.location.coordinates[1]
      let order_lng = orders[0].delivery_address.location.coordinates[0]
      if (booking_details.notification_flag == false) {
        let distance = await Driver.aggregate([
          {
            $geoNear: {
              near: {
                type: 'Point',
                coordinates: [
                  order_lng,
                  order_lat
                ]
              },
              key: 'location',
              spherical: true,
              distanceField: 'distance',
              distanceMultiplier: 0.001
            }
          },
          {
            $match: {
              _id: ObjectId(req.payload._id)
            }
          },
        ])
        if (distance && distance.length > 0) {
          if (distance[0].distance < 0.500) {
            user_details = await User.findOne({ _id: orders[0].user_details._id })
            await SendUserNotification(
              "Your order is on the way",
              "Driver is near by your location please open the door",
              "high",
              user_details.device_token
            )
            booking_details.notification_flag = true
            await booking_details.save()
          }
        }
      }
    }
    return res.json({
      status: true,
      data: {
        orders: orders,
        transfer_orders,
        suburbs,
        to_suburb: true,
        service_started,
        order_type,
      },
      // driver_stock
    });
  } catch (err) {
    console.log(err);
  }
};
