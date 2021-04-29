const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;

const User = mongoose.model("users");
const Address = mongoose.model("addresses");
const Suburb = mongoose.model("suburbs");
const Settings = mongoose.model("settings");
const Product = mongoose.model("products");
const TmpBooking = mongoose.model("tmp_bookings");
const Booking = mongoose.model("bookings");
const TmpPayment = mongoose.model("tmp_payments");
const Payment = mongoose.model("payments");
const Notification = mongoose.model("notifications");
const Coupon = mongoose.model("coupons");
const Driver = mongoose.model("drivers");
const Rating = mongoose.model("ratings");
const ScheduleStockLimit = mongoose.model("scheduled_stock_limits");
const CollectionPoint = mongoose.model("collectionpoints");
const BookingSlot = mongoose.model("booking_slots");
const Transaction = mongoose.model("transactions");
const Banner = mongoose.model("banners");
const Stock = mongoose.model("stocks");
const PayPal = require("@paypal/checkout-server-sdk");
const BrainTree = require("braintree");


const config = require("config");
const moment = require("moment");
const passport = require("passport");
const fs = require("fs");
const QRCode = require("qrcode");
const paginate = require("express-paginate");

// const { snedSignUpOtp } = require("../../utils/emails/user/signup_otp");
const { generateQrCode } = require("../../utils/qrcode");
const { trimMobile } = require("../../utils/general");

const SendUserNotification = require("../../jobs/user_notification");
const { sendUserSignInSms } = require("../../jobs/sendSms");

const { neworder_confirmed } = require("../../utils/emails/user/orders");

const SquareConnect = require("square-connect");
const { response } = require("express");
let defaultClient = SquareConnect.ApiClient.instance;
if (config.SQUARE_ENV == "DEMO") {
  defaultClient.basePath = "https://connect.squareupsandbox.com";
}
let oauth2 = defaultClient.authentications["oauth2"];
oauth2.accessToken = config.SQUARE_TOKEN;

const {
  ValidateUserSignUpInputs,
  ValidateUserSignupResendOtpInputs,
  ValidateUserSignUpVerifyOtpInputs,
  ValidateUserSignInInputs,
  ValidateUserSignInVerifyOtpInputs,
  ValidateUserCreditsInput,
  ValidateUserCredit,
  ValidateUserScheduleBookingInput,
  ValidateUserSaveScheduleCart,
  ValidateUserScheduleBookingConfirm,
  ValidateUserScheduledCartList,
  ValidateUserCreditConfirm,
  ValidateUserBulkBooking,
  ValidateUserFireBaseToken,
  ValidateUserAddressActive,
  ValidateScheduledOrderList,
  ValidateUserRateBooking,
  ValidateUserScheduledBookingUpdate,
  ValidateUserRealTimeBookingConfirm,
} = require("../../validators/usersValidator");
const {
  ValidateUserAddLocation,
} = require("../../validators/usersLocationValidator");
const tmp_bookings = require("../../models/tmp_bookings");
const tmp_payments = require("../../models/tmp_payments");
const { random } = require("underscore");
const { products } = require("./productController");

function randomString(length) {
  var chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  var result = "";
  for (var i = length; i > 0; --i)
    result += chars[Math.round(Math.random() * (chars.length - 1))];
  return result;
}
async function getDataUrl(str) {
  return QRCode.toDataURL(str, { errorCorrectionLevel: "M" });
}

exports.getComingShift = async () => {
  let offset = Math.abs(new Date().getTimezoneOffset());
  let today = moment().format("YYYY-MM-DD");
  let cur_date = moment()
    .utcOffset(+offset)
    .format("YYYY-MM-DD HH:mm");

  let current_slot = await Settings.aggregate([
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

  let setting = await Settings.aggregate([
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

  let setting2 = await Settings.aggregate([
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
  } else {
    return {
      coming_shift: null,
      shifts: setting2,
      date: new Date(moment().format("YYYY-MM-DD HH:MM")),
    };
  }
};
// check email exists
exports.checkEmailExists = async (email, id) => {
  let query = {
    delete_status: false,
    // verified: true,
    email,
  };
  if (id != null) {
    query._id = {
      $ne: id,
    };
  }
  return await User.countDocuments(query);
};

// check mobile exists
exports.checkMobileExists = async (mobile, id) => {
  let query = {
    delete_status: false,
    // verified: true,
    mobile,
  };
  if (id != null) {
    query._id = {
      $ne: id,
    };
  }
  return await User.countDocuments(query);
};

// Check user location with suburbs
exports.userLocationVerify = async (lat, lng) => {
  let distances = await Suburb.aggregate([
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
        query: {
          delete_status: false,
        },
      },
    },
    {
      $addFields: {
        isokey: {
          $cmp: ["$radius", "$distance"],
        },
      },
    },
    {
      $match: {
        isokey: {
          $gte: 0,
        },
      },
    },
  ]);
  if (distances.length > 0) {
    return true;
  } else {
    return false;
  }
};

//user login
exports.login = async (req, res, next) => {
  let { email, password } = req.body;

  if (!email) {
    return res.status(422).json({
      status: false,
      errors: ["Email is required"],
    });
  }

  if (!password) {
    return res.status(422).json({
      status: false,
      errors: ["Password is required"],
    });
  }

  await passport.authenticate(
    "local",
    { session: false },
    (err, passportUser, info) => {
      if (err) {
        return res
          .status(400)
          .json({ status: false, message: "Invalid login credentials" });
      }

      if (passportUser) {
        const user = passportUser;
        user.token = passportUser.generateJWT();
        return res.json({ user: user.toAuthJSON() });
      }

      return res
        .status(400)
        .json({ status: false, message: "Invalid login credentials" });
    }
  )(req, res, next);
};
// User sign in
exports.signIn = async (req, res) => {
  const { errors, isValid } = ValidateUserSignInInputs(req.body);
  // const { signInOtp } = require("../../utils/emails/user/login_otp");

  if (!isValid) {
    return res.json({
      status: false,
      message: errors[0],
    });
  }

  try {
    let { mobile } = req.body;
    mobile = trimMobile(mobile);
    if (
      (user = await User.findOne({
        $or: [
          {
            email: mobile,
          },
          {
            mobile: mobile,
          },
        ],
      }).sort({ _id: -1 }))
    ) {
      let otp = Math.floor(1000 + Math.random() * 9000);
      if (
        mobile == "9400903100" ||
        mobile == "9496334818" ||
        mobile == "8939568878"
      ) {
        otp = 1111;
      }
      user.otp = otp;
      await user.save();
      sendUserSignInSms.add({
        user_id: user._id,
      });
      // await signInOtp({
      //   name: user.name,
      //   email: user.email,
      //   otp: otp,
      // });
      return res.json({
        status: true,
        message: "An OTP has been send to provided mobile number",
        otp,
      });
    } else {
      return res.json({
        status: false,
        // message: "Invalid mobile number",
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

// verify sign in otp
exports.verifySignInOtp = async (req, res) => {
  const { errors, isValid } = ValidateUserSignInVerifyOtpInputs(req.body);
  if (!isValid) {
    return res.json({
      status: false,
      message: errors[0],
    });
  }
  try {
    let { mobile, otp } = req.body;
    mobile = trimMobile(mobile);
    let user = await User.findOne({
      delete_status: false,
      $or: [
        {
          mobile: mobile,
        },
        {
          email: mobile,
        },
      ],
    }).sort({ _id: -1 });
    if (user) {
      if (user.otp == otp) {
        user.otp = null;
        user.verified = true;
        await user.save();
        return res.json({
          status: true,
          message: "OTP verified successfully",
          data: user.toAuthJSON(),
        });
      } else {
        return res.json({
          status: false,
          message: "OTP verfication failed",
        });
      }
    } else {
      return res.json({
        status: false,
        message: "User not found",
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

// user sign up
exports.signUp = async (req, res) => {
  const { errors, isValid } = ValidateUserSignUpInputs(req.body);
  if (!isValid) {
    return res.json({
      status: false,
      message: errors[0],
    });
  }
  try {
    let { name, email, mobile, refferal_code } = req.body;
    mobile = trimMobile(mobile);
    // return res.json(mobile)
    if (await this.checkMobileExists(mobile, null)) {
      return res.json({
        status: false,
        message: "Mobile number already registered with us",
      });
    }
    if (await this.checkEmailExists(email, null)) {
      return res.json({
        status: false,
        message: "Email already registered with us",
      });
    }
    let otp = Math.floor(1000 + Math.random() * 9000);
    if (
      mobile == "9400903100" ||
      mobile == "9496334818" ||
      mobile == "8939568878"
    ) {
      otp = 1111;
    }
    let user = await User.findOne({
      name,
      mobile,
      delete_status: false,
    }).sort({ _id: -1 });
    if (!user) {
      user = new User();
    }
    user.name = name;
    user.email = email;
    user.mobile = mobile;
    user.otp = otp;
    user.created_at = Date.now();
    // await user.save()
    // let user = new User({
    //   name,
    //   email,
    //   mobile,
    //   otp: otp,
    // });
    if (refferal_code) {
      let user_details = await User.findOne({
        refferal_code,
      });
      if (user_details) user.reffered_by = user_details._id;
    }
    // await snedSignUpOtp({
    //   name,
    //   email,
    //   otp: otp,
    // });
    let ref = randomString(8);
    let count = await User.countDocuments({
      refferal_code: ref,
    });
    while (count) {
      ref = randomString(8);
    }
    user.refferal_code = ref;
    await user.save();
    sendUserSignInSms.add({
      user_id: user._id,
    });
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

// resend sign up otp
exports.resendSignUpOtp = async (req, res) => {
  const { errors, isValid } = ValidateUserSignupResendOtpInputs(req.body);
  if (!isValid) {
    return res.json({
      status: false,
      message: errors[0],
    });
  }
  try {
    let { mobile } = req.body;
    mobile = trimMobile(mobile);
    let user = await User.findOne({
      mobile,
      delete_status: false,
    }).sort({
      _id: -1,
    });
    if (user) {
      let otp = Math.floor(1000 + Math.random() * 9000);
      user.otp = otp;
      await user.save();
      sendUserSignInSms.add({
        user_id: user._id,
      });
      // await snedSignUpOtp({
      //   name: user.name,
      //   email: user.email,
      //   otp: otp,
      // });
      return res.json({
        status: true,
        message: "An OTP has been send to provided mobile number",
        otp,
      });
    } else {
      return res.json({
        status: false,
        message: "User not found",
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

// verfiy sign up otp
exports.verifySignUpOtp = async (req, res) => {
  const { welcomeMail } = require("../../utils/emails/user/welcome_mail");
  const { errors, isValid } = ValidateUserSignUpVerifyOtpInputs(req.body);
  if (!isValid) {
    return res.json({
      status: false,
      message: errors[0],
    });
  }
  try {
    let { mobile, otp } = req.body;
    mobile = trimMobile(mobile);
    let user = await User.findOne({
      mobile,
      delete_status: false,
    }).sort({ _id: -1 });
    if (user) {
      if (user.otp == otp) {
        user.otp = null;
        // let ref = randomString(8)
        // let count = await User.countDocuments({
        //   refferal_code: ref
        // })
        // while (count) {
        //   ref = randomString(8)
        // }
        // user.refferal_code = ref
        await user.save();
        await welcomeMail({
          name: user.name,
          to_email: user.email,
          mobile: user.mobile,
        });
        return res.json({
          status: true,
          message: "OTP verified successfully",
          data: user.toAuthJSON(),
        });
      } else {
        return res.json({
          status: false,
          message: "OTP verfication failed",
        });
      }
    } else {
      return res.json({
        status: false,
        message: "User not found",
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

// verify user location with sububs
exports.verifyUserLocation = async (req, res) => {
  try {
    var { lat, lng } = req.body;
    let errors = [];
    if (!lat || lat == "") errors.push("Latitude is required");
    if (!lng || lng == "") errors.push("Longitude is required");
    if (errors.length > 0) {
      return res.json({
        status: false,
        message: errors[0],
      });
    }
    if (await this.userLocationVerify(lat, lng)) {
      return res.json({
        status: true,
        message: "Proceed to next step",
      });
    } else {
      return res.json({
        status: false,
        message: "Sorry we don't work there",
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

exports.addLocation = async (req, res) => {
  try {
    const { errors, isValid } = ValidateUserAddLocation(req.body);
    if (!isValid) {
      return res.json({
        status: false,
        message: errors[0],
      });
    }
    let {
      _id,
      location_name,
      lat,
      lng,
      house_flat_no,
      appartment,
      landmark,
      to_reach,
      contact_person,
      address_type,
      suburb,
      pincode,
    } = req.body;
    if (!(await this.userLocationVerify(lat, lng))) {
      return res.json({
        status: false,
        message: "Sorry we don't work there",
      });
    }
    if (_id) {
      user_location = await Address.findOne({
        _id,
        user_id: req.payload._id,
      });
      user_location.updated_at = Date.now();
    } else {
      user_location = new Address();
      user_location.created_at = Date.now();
      user_location.active_location = true;
    }
    user_location.address_line1 = location_name;
    user_location.location = {
      type: "Point",
      coordinates: [lng, lat],
    };
    user_location.suburb_id = suburb;
    user_location.house_flat_no = house_flat_no;
    user_location.appartment = appartment;
    user_location.landmark = landmark;
    user_location.to_reach = to_reach;
    user_location.contact_person = contact_person;
    user_location.address_type = address_type;
    user_location.user_id = req.payload._id;
    user_location.pincode = pincode;
    await user_location.save();
    await Address.updateMany(
      {
        _id: {
          $ne: user_location._id,
        },
        user_id: req.payload._id,
      },
      {
        $set: {
          active_location: false,
        },
      }
    );
    return res.json({
      status: true,
      message: "Location has been added successfully",
    });
  } catch (err) {
    console.log(err);
    return res.json({
      status: false,
      message: "Sorry something went wrong",
    });
  }
};

exports.deleteLocation = async (req, res) => {
  try {
    let { _id } = req.body;
    let location = await Address.findOne({
      _id,
      user_id: req.payload._id,
    });
    if (location.user_id == req.payload._id) {
      if (location.active_location == true) {
        return res.json({
          status: false,
          message: "Active location cannot be deleted",
        });
      } else {
        (location.delete_status = true), (location.deleted_at = Date.now());
        await location.save();
        return res.json({
          status: true,
          message: "Location has been deleted",
        });
      }
    } else {
      return res.json({
        status: false,
        message: "Oops.. Operation not possible!",
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

exports.getLocations = async (req, res) => {
  try {
    let locations = await Address.find(
      {
        delete_status: false,
        user_id: req.payload._id,
      },
      {
        type: 0,
        delete_status: 0,
        __v: 0,
        user_id: 0,
      }
    );
    return res.json({
      status: true,
      data: locations,
    });
  } catch (err) {
    console.log(err);
    return res.json({
      status: false,
      message: "Sorry something went wrong",
    });
  }
};

exports.viewProfile = async (req, res) => {
  try {
    let user_id = ObjectId(req.payload._id);
    let user = await User.aggregate([
      {
        $match: {
          _id: user_id,
        },
      },
      {
        $lookup: {
          from: "users_locations",
          let: { user_id: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$user_id", "$$user_id"] },
                    { $eq: ["$active_location", true] },
                    { $eq: ["$delete_status", false] },
                  ],
                },
              },
            },
            {
              $project: {
                active_location: 0,
                user_id: 0,
                __v: 0,
                delete_status: 0,
                deleted_at: 0,
              },
            },
          ],
          as: "locations",
        },
      },
      {
        $project: {
          name: 1,
          email: 1,
          mobile: 1,
          refferal_code: 1,
          profile_pic: 1,
          created_at: 1,
          updated_at: 1,
          location: {
            $arrayElemAt: ["$locations", 0],
          },
        },
      },
    ]);
    return res.json({
      status: true,
      data: user[0],
    });
  } catch (err) {
    console.log(err);
    return res.json({
      status: false,
      message: "Sorry something went wrong",
    });
  }
};

exports.updateProfilePic = async (req, res) => {
  const uploadProfilePic = require("../../utils/uploads/user_profilepic");
  try {
    await uploadProfilePic(req, res);
  } catch (err) {
    console.log(err);
    return res.json({
      status: false,
      message: "Could not upload profile picture",
    });
  }
  try {
    let { profile_pic } = req.files;
    let user = await User.findOne({
      _id: req.payload._id,
    });
    user.profile_pic = profile_pic[0].path || null;
    await user.save();
    return res.json({
      status: true,
      message: "Profile picture updated successfully",
    });
  } catch (err) {
    console.log(err);
    return res.json({
      status: false,
      message: "Sorry something went wrong",
    });
  }
};

exports.deleteProfilePic = async (req, res) => {
  try {
    let user = await User.findOne({
      _id: req.payload._id,
    });
    // fs.unlinkSync(user.profile_pic.slice(1));
    user.profile_pic = null;
    await user.save();
    return res.json({
      status: true,
      message: "Profile pic has been removed",
    });
  } catch (err) {
    console.log(err);
    return res.json({
      status: false,
      message: "Sorry something went wrong",
    });
  }
};

// exports.addCredits = async (req, res) => {
//   try {
//     const { errors, isValid } = ValidateUserCreditsInput(req.body);
//     if (!isValid) {
//       return res.json({
//         status: false,
//         message: errors[0],
//       });
//     }
//     let { amount } = req.body
//     let temp_payment = new TmpPayment({
//       user_id: req.payload._id,
//       date: new Date(moment().format('YYYY-MM-DD')),
//       actual_price: amount,
//       total_price: amount,
//       payment_type: 'ONLINE',
//       is_credit: true
//     })
//     let saved_details = await temp_payment.save()
//     return res.json({
//       status: true,
//       data: {
//         tmp_payment_id: saved_details._id
//       },
//       message: "Credit amount has been saved"
//     })
//   } catch (err) {
//     console.log(err)
//     return res.json({
//       status: false,
//       message: 'Sorry something went wrong'
//     })
//   }
// }

exports.addCredits = async (req, res) => {
  try {
    const { errors, isValid } = ValidateUserCreditsInput(req.body);
    if (!isValid) {
      return res.json({
        status: false,
        message: errors[0],
      });
    }
    let { amount, transaction_id, type } = req.body;
    let payment = new Payment({
      user_id: req.payload._id,
      transaction_id: transaction_id,
      date: new Date(moment().format("YYYY-MM-DD")),
      actual_price: amount,
      total_price: amount,
      payment_type: "ONLINE",
      is_credit: true,
    });

    let transaction = new Transaction({
      user_id: req.payload._id,
      payment_id: transaction_id,
      amount,
      gateway: type,
      type: "RNG-CREDITS",
      date: new Date(moment().format("YYYY-MM-DD HH:mm:ss")),
    });
    await transaction.save();

    let user = await User.findOne({
      _id: req.payload._id,
    });
    user.credits.food = user.credits.food + parseFloat(amount);
    await user.save();
    await payment.save();
    await SendUserNotification(
      "Food credits added",
      "Food credits added to your account",
      "high",
      user.device_token
    );
    return res.json({
      status: true,
      message: "Payment has been completed",
    });
  } catch (err) {
    console.log(err);
    return res.json({
      status: false,
      message: "Sorry something went wrong",
    });
  }
};

exports.confirmAddCredits = async (req, res) => {
  try {
    let { errors, isValid } = ValidateUserCreditConfirm(req.body);
    if (!isValid) {
      return res.json({
        status: false,
        message: errors[0],
      });
    }
    let { transaction_id, tmp_payment_id } = req.body;
    let tmp_payment = await TmpPayment.findOne({
      _id: tmp_payment_id,
      user_id: req.payload._id,
    });
    let payment = new Payment({
      user_id: req.payload._id,
      transaction_id: transaction_id,
      date: new Date(moment().format("YYYY-MM-DD")),
      actual_price: tmp_payment.actual_price,
      total_price: tmp_payment.total_price,
      payment_type: tmp_payment.payment_type,
      is_credit: true,
    });
    let user = await User.findOne({
      _id: req.payload._id,
    });
    user.credits.food = user.credits.food + parseFloat(tmp_payment.total_price);
    await user.save();
    await tmp_payment.delete();
    await payment.save();
    await SendUserNotification(
      "Food credits added",
      "Food credits added to your account",
      "high",
      user.device_token
    );

    return res.json({
      status: true,
      message: "Payment has been completed",
    });
  } catch (err) {
    console.log(err);
    return res.json({
      status: false,
      message: "Sorry something went wrong",
    });
  }
};

exports.getCreditAmount = async (req, res) => {
  try {
    let user = await User.findOne({
      _id: req.payload._id,
    });
    let data = {};
    console.log(user);
    if (user.credits) {
      data.food_credit = user.credits.food;
    } else {
      data.food_credit = 0;
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

// exports.getCollectionPoints = async (req, res) => {
//   try {
//     let user_address = await Address.findOne({
//       user_id: req.payload._id,
//       active_location: true,
//       type: 'USER'
//     }, {
//       location: 1
//     })
//     if (user_address) {
//       let collection_points = await Address.aggregate([
//         {
//           $geoNear: {
//             near: {
//               type: "Point",
//               coordinates: [
//                 user_address.location.coordinates[0],
//                 user_address.location.coordinates[1]
//               ]
//             },
//             key: "location",
//             spherical: true,
//             distanceField: "distance",
//             distanceMultiplier: 0.001,
//             query: {
//               delete_status: false,
//               type: "COLLECTION_POINT"
//             }
//           }
//         },
//         {
//           $match: {
//             distance: {
//               $lte: 15
//             }
//           }
//         },
//         {
//           $lookup: {
//             from: 'collectionpoints',
//             let: {
//               collectionpoint_id: "$collectionpoint_id"
//             },
//             pipeline: [
//               {
//                 $match: {
//                   delete_status: false,
//                   approved: true,
//                   $expr: {
//                     $eq: ["$_id", "$$collectionpoint_id"]
//                   }
//                 }
//               },
//               {
//                 $project: {
//                   name: 1,
//                   contact_name: 1,
//                   email: 1,
//                   mobile: 1,
//                   image: 1
//                 }
//               }
//             ],
//             as: "collection_point"
//           }
//         },
//         {
//           $lookup: {
//             from: 'suburbs',
//             let: {
//               suburb_id: "$suburb_id"
//             },
//             pipeline: [
//               {
//                 $match: {
//                   delete_status: false,
//                   active: true,
//                   $expr: {
//                     $eq: ["$_id", "$$suburb_id"]
//                   }
//                 }
//               },
//               {
//                 $project: {
//                   name: 1,
//                   address: 1,
//                   radius: 1
//                 }
//               }
//             ],
//             as: "suburb"
//           }
//         },
//         {
//           $project: {
//             location: 1,
//             address_line1: 1,
//             address_line2: 1,
//             distance: 1,
//             suburb: {
//               $arrayElemAt: ["$suburb", 0]
//             },
//             collection_point: {
//               $arrayElemAt: ["$collection_point", 0]
//             }
//           }
//         },
//         {
//           $project: {
//             _id: "$collection_point._id",
//             name: "$collection_point.name",
//             email: "$collection_point.email",
//             mobile: "$collection_point.mobile",
//             contact_name: "$collection_point.contact_name",
//             image: "$collection_point.image",
//             location: 1,
//             address_line1: 1,
//             address_line2: 1,
//             distance: 1,
//             suburb: 1
//           }
//         },
//         {
//           $sort: {
//             distance: 1
//           }
//         }
//       ])
//       return res.json({
//         status: true,
//         data: collection_points
//       })
//     } else {
//       return res.json({
//         status: false,
//         message: 'Please select your location first'
//       })
//     }
//   } catch (err) {
//     console.log(err)
//     return res.json({
//       status: false,
//       message: 'Sorry something went wrong'
//     })
//   }
// }

exports.getCollectionPoints = async (req, res) => {
  try {
    let user_address = await Address.findOne({
      user_id: req.payload._id,
      active_location: true,
      delete_status: false,
    });
    let collection_points = await CollectionPoint.aggregate([
      {
        $match: {
          approved: true,
          delete_status: false,
        },
      },
      {
        $lookup: {
          from: "addresses",
          let: {
            collectionpoint_id: "$_id",
          },
          pipeline: [
            {
              $geoNear: {
                near: {
                  type: "Point",
                  coordinates: [
                    user_address.location.coordinates[0],
                    user_address.location.coordinates[1],
                  ],
                },
                key: "location",
                spherical: true,
                distanceField: "distance",
                distanceMultiplier: 0.001,
              },
            },
            {
              $match: {
                // suburb_id: ObjectId(user_address.suburb_id),
                $expr: {
                  $eq: ["$collectionpoint_id", "$$collectionpoint_id"],
                },
              },
            },
          ],
          as: "address",
        },
      },
      {
        $unwind: "$address",
      },
      {
        $lookup: {
          from: "suburbs",
          let: {
            s_id: "$address.suburb_id",
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: ["$_id", "$$s_id"],
                },
              },
            },
            {
              $project: {
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
        $project: {
          location: "$address.location",
          address_line1: "$address.address_line1",
          address_line2: "$address.address_line2",
          distance: "$address.distance",
          suburb: {
            $arrayElemAt: ["$suburb", 0],
          },
          name: 1,
          email: 1,
          mobile: 1,
          contact_name: 1,
          image: 1,
          starttime: 1,
          closetime: 1,
        },
      },
      {
        $sort: {
          distance: 1,
        },
      },
    ]);
    return res.json({
      status: true,
      data: collection_points,
    });
  } catch (err) {
    console.log(err);
    return res.json({
      status: false,
      message: "Sorry something went wrong",
    });
  }
};
exports.getProductList = async (req, res) => {
  try {
    let settings = await Settings.findOne(
      {},
      {
        price: 1,
      }
    );
    let products = await Product.aggregate([
      {
        $match: {
          delete_status: false,
          is_regular: true,
          // type: 'FOOD'
        },
      },
      {
        $project: {
          cover_pic: 1,
          image: 1,
          name: 1,
          description: 1,
          price: 1,
          type: 1,
        },
      },
      {
        $sort: {
          type: -1,
          name: 1,
        },
      },
      // {
      //   $addFields: {
      //     price: settings.price.food
      //   }
      // }
    ]);
    return res.json({
      status: true,
      data: products,
    });
  } catch (err) {
    console.log(err);
    return res.json({
      status: false,
      message: "Sorry something went wrong",
    });
  }
};

exports.scheduleBooking = async (req, res) => {
  try {
    // const { errors, isValid } = ValidateUserScheduleBookingInput(req.body)
    // if(!isValid) {
    //   return res.json({
    //     status: false,
    //     message: errors[0]
    //   })
    // }
    return res.json({
      data: req.body.data,
    });
  } catch (err) {
    console.log(err);
    return res.json({
      status: false,
      message: "Sorry something went wrong",
    });
  }
};

exports.saveScheduleCartLimitCheck = async (req, res) => {
  try {
    let { errors, isValid } = ValidateUserSaveScheduleCart(req.body);
    if (!isValid) {
      return res.json({
        status: false,
        message: errors[0],
      });
    }
    let {
      delivery_type,
      collectionpoint_id,
      address_id,
      scheduled_date,
      shift_id,
      product_id,
      operation,
      price,
      next_count,
    } = req.body;
    if (
      new Date(scheduled_date).getTime() / 1000 <
      new Date("2020-12-19").getTime() / 1000
    ) {
      console.log("___________________________________bloced");
      return res.json({
        status: false,
        message: "Schedule booking will be available after 19th December",
      });
    }
    if (delivery_type == "ONLINE") {
      let user_address = await Address.findOne({
        _id: address_id,
      });
      let suburb_details = await Suburb.findOne({
        _id: user_address.suburb_id,
      });

      if (suburb_details && suburb_details.has_realtime_order == false) {
        return res.json({
          status: false,
          message: "Delivery not available for your current address",
        });
      }
    }
    let setting = await Settings.findOne();
    let min_schedule_hour = 0;
    if (setting.min_schedule_hour) {
      min_schedule_hour = setting.min_schedule_hour;
    }
    let offset = Math.abs(new Date().getTimezoneOffset());
    let s_date = moment(scheduled_date).format("YYYY-MM-DD");
    let cur_date = moment()
      .utcOffset(+offset)
      .format("YYYY-MM-DD HH:mm");
    let c_shift = await Settings.aggregate([
      {
        $unwind: "$shift_times",
      },
      {
        $project: {
          _id: "$shift_times._id",
          name: "$shift_times.name",
          time: "$shift_times.time",
        },
      },
      {
        $match: {
          _id: ObjectId(shift_id),
        },
      },
      {
        $addFields: {
          start: {
            $toDate: {
              $concat: [s_date, " ", "$time"],
            },
          },
          current_date: cur_date,
        },
      },
      {
        $addFields: {
          current_date: {
            $toDate: "$current_date",
          },
        },
      },
      {
        $addFields: {
          date_difference: {
            $subtract: ["$start", "$current_date"],
          },
        },
      },
      {
        $match: {
          date_difference: {
            $gte: 3600000 * min_schedule_hour,
          },
        },
      },
    ]);
    if (c_shift.length == 0) {
      return res.json({
        status: false,
        message: `Scheduled order can only placed before ${min_schedule_hour} hours`,
      });
    }
    if (typeof next_count === "undefined") {
      return res.json({
        status: false,
        message: "Next count is required",
      });
    }
    if (next_count == "" || next_count == 0) {
      return res.json({
        status: false,
        message: "Next count is required",
      });
    }
    // if (new Date(scheduled_date) <= new Date()) {
    //   return res.json({
    //     status: false,
    //     message: 'Invalid date is provided'
    //   })
    // }
    let query = {
      user_id: req.payload._id,
      booking_type: "SCHEDULED",
      scheduled_date: new Date(moment(scheduled_date).format("YYYY-MM-DD")),
      shift_id,
      product_id,
      delete_status: false,
    };
    let save_data = {};
    var address_details;
    if (delivery_type == "COLLECTIONPOINT") {
      address_details = await Address.findOne({
        collectionpoint_id,
      });
      (query.collectionpoint_id = collectionpoint_id),
        (save_data.collectionpoint_id = collectionpoint_id);
    } else {
      address_details = await Address.findOne({
        _id: address_id,
      });
      query.address_id = address_id;
      save_data.address_id = address_id;
    }
    scheduled_cart = await TmpBooking.findOne(query);
    let stock_limit = await ScheduleStockLimit.findOne({
      shift_id,
      product_id,
      suburb_id: address_details.suburb_id,
      delete_status: false,
    });
    let current_orders = await Booking.aggregate([
      {
        $match: {
          scheduled_date: new Date(moment(scheduled_date).format("YYYY-MM-DD")),
          shift_id: ObjectId(shift_id),
        },
      },
      {
        $lookup: {
          from: "addresses",
          let: {
            collectionpoint_id: "$collectionpoint_id",
            delivery_type: "$delivery_type",
            address_id: "$address_id",
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $cond: {
                    if: {
                      $eq: ["$$delivery_type", "ONLINE"],
                    },
                    then: {
                      $eq: ["$_id", "$$address_id"],
                    },
                    else: {
                      $eq: ["$collectionpoint_id", "$$collectionpoint_id"],
                    },
                  },
                  // $eq: ["$collectionpoint_id", "$$collectionpoint_id"]
                },
              },
            },
            {
              $project: {
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
        $match: {
          "address.suburb_id": ObjectId(address_details.suburb_id),
        },
      },
      {
        $project: {
          products: {
            $filter: {
              input: "$orders",
              as: "order",
              cond: {
                $eq: ["$$order.product_id", ObjectId(product_id)],
              },
            },
          },
        },
      },
      {
        $project: {
          products: {
            $arrayElemAt: ["$products", 0],
          },
        },
      },
      {
        $project: {
          product_id: "$products.product_id",
          quantity: "$products.quantity",
        },
      },
      {
        $group: {
          _id: null,
          total_quantity: {
            $sum: "$quantity",
          },
        },
      },
    ]);
    if (current_orders.length > 0 && current_orders[0].total_quantity == 0) {
      if (stock_limit) {
        let limit = stock_limit.limit;
        if (next_count > limit) {
          return res.json({
            status: false,
            message:
              "Maximum count for schedule current product reached for today",
          });
        }
      }
    } else if (
      current_orders.length > 0 &&
      current_orders[0].total_quantity > 0
    ) {
      if (stock_limit) {
        let rem =
          parseInt(stock_limit.limit) -
          parseInt(current_orders[0].total_quantity);
        if (next_count > rem) {
          return res.json({
            status: false,
            message:
              "Maximum count for schedule current product reached for today",
          });
        }
      }
    } else if (current_orders.length == 0) {
      if (stock_limit) {
        let limit = stock_limit.limit;
        if (next_count > limit) {
          return res.json({
            status: false,
            message:
              "Maximum count for schedule current product reached for today",
          });
        }
      }
    }
    // if(current_orders.length > 0 && stock_limit) {
    //   rem = parseInt(stock_limit.limit) - parseInt(current_orders[0].total_quantity)
    //   if(next_count > rem) {
    //     return res.json({
    //       status: false,
    //       message: 'Maximum count for schedule current product reached for today'
    //     })
    //   }
    // }
    // return res.json({
    //   status: false,
    //   current_orders,
    //   stock_limit
    // })
    if (scheduled_cart) {
      if (operation == "ADD") {
        scheduled_cart.quantity = scheduled_cart.quantity + 1;
        await scheduled_cart.save();
        return res.json({
          status: true,
          message: "Item added",
        });
      } else if (operation == "REMOVE") {
        if (scheduled_cart.quantity == 1) {
          await scheduled_cart.delete();
          return res.json({
            status: true,
            message: "Item removed",
          });
        } else {
          scheduled_cart.quantity = scheduled_cart.quantity - 1;
          await scheduled_cart.save();
          return res.json({
            status: true,
            message: "Item removed",
          });
        }
      } else {
        return res.json({
          status: false,
          message: "Invalid Operation",
        });
      }
    } else {
      save_data.user_id = req.payload._id;
      save_data.booking_type = "SCHEDULED";
      save_data.delivery_type = delivery_type;
      // save_data.scheduled_date = new Date(scheduled_date),
      save_data.scheduled_date = new Date(
        moment(scheduled_date).format("YYYY-MM-DD")
      );
      save_data.shift_id = shift_id;
      save_data.product_id = product_id;
      save_data.quantity = 1;
      save_data.price = price;
      save_data.created_at = Date.now();

      scheduled_cart = new TmpBooking(save_data);
      if (operation == "ADD") {
        await scheduled_cart.save();
        return res.json({
          status: true,
          message: "Item added",
        });
      } else {
        return res.json({
          status: false,
          message: "No items found",
        });
      }
    }
  } catch (err) {
    console.log(err);
    return res.json({
      status: false,
      message: "Sorry something went wrong",
    });
  }
};

exports.saveScheduleCart = async (req, res) => {
  try {
    let { errors, isValid } = ValidateUserSaveScheduleCart(req.body);
    if (!isValid) {
      return res.json({
        status: false,
        message: errors[0],
      });
    }
    let {
      delivery_type,
      collectionpoint_id,
      address_id,
      scheduled_date,
      shift_id,
      product_id,
      operation,
      price,
    } = req.body;

    if (new Date(scheduled_date) <= new Date()) {
      return res.json({
        status: false,
        message: "Invalid date is provided",
      });
    }
    let query = {
      user_id: req.payload._id,
      booking_type: "SCHEDULED",
      scheduled_date: new Date(moment(scheduled_date).format("YYYY-MM-DD")),
      shift_id,
      product_id,
      delete_status: false,
    };
    let save_data = {};
    if (delivery_type == "COLLECTIONPOINT") {
      (query.collectionpoint_id = collectionpoint_id),
        (save_data.collectionpoint_id = collectionpoint_id);
    } else {
      query.address_id = address_id;
      save_data.address_id = address_id;
    }
    scheduled_cart = await TmpBooking.findOne(query);
    if (scheduled_cart) {
      if (operation == "ADD") {
        scheduled_cart.quantity = scheduled_cart.quantity + 1;
        await scheduled_cart.save();
        return res.json({
          status: true,
          message: "Item added",
        });
      } else if (operation == "REMOVE") {
        if (scheduled_cart.quantity == 1) {
          await scheduled_cart.delete();
          return res.json({
            status: true,
            message: "Item removed",
          });
        } else {
          scheduled_cart.quantity = scheduled_cart.quantity - 1;
          await scheduled_cart.save();
          return res.json({
            status: true,
            message: "Item removed",
          });
        }
      } else {
        return res.json({
          status: false,
          message: "Invalid Operation",
        });
      }
    } else {
      (save_data.user_id = req.payload._id),
        (save_data.booking_type = "SCHEDULED"),
        (save_data.delivery_type = delivery_type),
        // save_data.scheduled_date = new Date(scheduled_date),
        (save_data.scheduled_date = new Date(
          moment(scheduled_date).format("YYYY-MM-DD")
        ));
      (save_data.shift_id = shift_id),
        (save_data.product_id = product_id),
        (save_data.quantity = 1),
        (save_data.price = price),
        (save_data.created_at = Date.now());

      scheduled_cart = new TmpBooking(save_data);
      if (operation == "ADD") {
        await scheduled_cart.save();
        return res.json({
          status: true,
          message: "Item added",
        });
      } else {
        return res.json({
          status: false,
          message: "No items found",
        });
      }
    }
  } catch (err) {
    console.log(err);
    return res.json({
      status: false,
      message: "Sorry something went wrong",
    });
  }
};

// exports.confirmScheduledBooking = async (req, res) => {
//   try {
//     let { errors, isValid } = ValidateUserScheduleBookingConfirm(req.body)
//     if (!isValid) {
//       return res.json({
//         status: false,
//         message: errors[0]
//       })
//     }
//     let { delivery_type, shift_id, address_id, collectionpoint_id, credit_used, transaction_id, amount } = req.body
//     let query = []
//     if (delivery_type == "ONLINE") {
//       query.push(
//         {
//           $match: {
//             user_id: ObjectId(req.payload._id),
//             booking_type: 'SCHEDULED',
//             delete_status: false,
//             quantity: {
//               $gt: 0
//             },
//             // scheduled_date: {
//             //   $gt: new Date()
//             // },
//             delivery_type: 'ONLINE',
//             shift_id: ObjectId(shift_id),
//             address_id: ObjectId(address_id)
//           }
//         },
//         {
//           $group: {
//             _id: {
//               user_id: "$user_id",
//               delivery_type: "ONLINE",
//               address_id: "$address_id",
//               scheduled_date: "$scheduled_date",
//               shift_id: "$shift_id",
//             },
//             total_products: {
//               $sum: "$quantity"
//             },
//             total_price: {
//               $sum: {
//                 $multiply: ["$quantity", "$price"]
//               }
//             },
//             orders: {
//               $push: {
//                 product_id: "$product_id",
//                 quantity: "$quantity",
//                 price: "$price"
//               }
//             }
//           }
//         },
//         {
//           $project: {
//             _id: 0,
//             user_id: "$_id.user_id",
//             delivery_type: "$_id.delivery_type",
//             address_id: "$_id.address_id",
//             scheduled_date: "$_id.scheduled_date",
//             shift_id: "$_id.shift_id",
//             total_products: "$total_products",
//             total_price: "$total_price",
//             orders: "$orders",
//           }
//         },
//       )
//     } else {
//       query.push(
//         {
//           $match: {
//             user_id: ObjectId(req.payload._id),
//             booking_type: "SCHEDULED",
//             delete_status: false,
//             quantity: {
//               $gt: 0
//             },
//             delivery_type: 'COLLECTIONPOINT',
//             shift_id: ObjectId(shift_id),
//             collectionpoint_id: ObjectId(collectionpoint_id)
//           }
//         },
//         {
//           $group: {
//             _id: {
//               user_id: "$user_id",
//               delivery_type: "COLLECTIONPOINT",
//               collectionpoint_id: "$collectionpoint_id",
//               scheduled_date: "$scheduled_date",
//               shift_id: "$shift_id",
//             },
//             total_products: {
//               $sum: "$quantity"
//             },
//             total_price: {
//               $sum: {
//                 $multiply: ["$quantity", "$price"]
//               }
//             },
//             orders: {
//               $push: {
//                 product_id: "$product_id",
//                 quantity: "$quantity",
//                 price: "$price"
//               }
//             }
//           }
//         },
//         {
//           $project: {
//             _id: 0,
//             user_id: "$_id.user_id",
//             delivery_type: "$_id.delivery_type",
//             collectionpoint_id: "$_id.collectionpoint_id",
//             address_id: "$_id.address_id",
//             scheduled_date: "$_id.scheduled_date",
//             shift_id: "$_id.shift_id",
//             total_products: "$total_products",
//             total_price: "$total_price",
//             orders: "$orders",
//           }
//         },
//       )
//     }
//     let tmp_scheduled_bookings = await TmpBooking.aggregate(query)
//     // return res.json({
//     //   status: false,
//     //   tmp_scheduled_bookings
//     // })
//     let grand_total_query = query
//     grand_total_query.push(
//       {
//         $group: {
//           _id: null,
//           grand_total: {
//             $sum: "$total_price"
//           }
//         }
//       }
//     )
//     let tmp_scheduled_total_amount = await TmpBooking.aggregate(grand_total_query)
//     if (tmp_scheduled_bookings && tmp_scheduled_bookings.length > 0) {
//       // for (var i = 0; i < tmp_scheduled_bookings.length; i++) {
//       //   if (delivery_type == "ONLINE" && tmp_scheduled_bookings[i].total_products < 3) {
//       //     return res.json({
//       //       status: false,
//       //       message: "For delivery you have to choose more than 2 foods "
//       //     })
//       //   }
//       // }

//       if (transaction_id) {
//         let payment = new Payment({
//           user_id: req.payload._id,
//           transaction_id,
//           date: new Date(moment().format('YYYY-MM-DD')),
//           actual_price: amount,
//           total_price: amount,
//           is_credit: true
//         })
//         await payment.save()
//       }
//       let user = await User.findOne({
//         _id: req.payload._id
//       }, {
//         credits: 1,
//         first_order: 1,
//         reffered_by: 1
//       })
//       // if (user.credits.food < tmp_scheduled_total_amount[0].grand_total) {
//       //   return res.json({
//       //     status: false,
//       //     message: "Purchase more credits"
//       //   })
//       // }
//       let last_booking_id = await Booking.findOne({}, {
//         _id: 0,
//         booking_id: 1
//       }).sort({ _id: -1 })
//       if (last_booking_id) {
//         bokid = last_booking_id.booking_id.split("-")
//         bk_id = bokid[2]
//       } else {
//         bk_id = config.SCHEDULED_BOOKING_ID_START
//       }
//       let insert_data = []
//       for (var i = 0; i < tmp_scheduled_bookings.length; i++) {
//         let booking_id = `${config.SCHEDULED_BOOKING_ID_PREFIX}${parseInt(bk_id) + 1}`
//         let order = {}
//         order.booking_id = booking_id
//         order.user_id = tmp_scheduled_bookings[i].user_id
//         order.delivery_type = tmp_scheduled_bookings[i].delivery_type
//         order.address_id = tmp_scheduled_bookings[i].address_id
//         order.collectionpoint_id = tmp_scheduled_bookings[i].collectionpoint_id
//         order.scheduled_date = new Date(moment(tmp_scheduled_bookings[i].scheduled_date).format('YYYY-MM-DD'))
//         order.shift_id = tmp_scheduled_bookings[i].shift_id
//         order.orders = tmp_scheduled_bookings[i].orders
//         order.booking_type = "SCHEDULED"
//         order.qrcode = await getDataUrl(booking_id)
//         insert_data.push(order)
//         bk_id = parseInt(bk_id) + 1
//       }
//       await Booking.insertMany(insert_data)
//       // user.credits.food = user.credits.food - parseInt(tmp_scheduled_total_amount[0].grand_total)
//       user.credits.food = user.credits.food - parseFloat(credit_used)
//       await user.save()
//       await TmpBooking.deleteMany({
//         user_id: req.payload._id,
//         booking_type: "SCHEDULED",
//         delivery_type,
//         shift_id
//       })
//       if (user.first_order == false) {
//         if (user.reffered_by) {
//           let reffered_user = await User.findOne({
//             _id: user.reffered_by
//           })
//           reffered_user.credits.food = parseFloat(reffered_user.credits.food) + parseFloat(tmp_scheduled_bookings[0].orders[0].price)
//           await reffered_user.save()
//           await SendUserNotification(
//             "Your account is credited",
//             `${tmp_scheduled_bookings[0].orders[0].price} $ credited to your account from your referee on his first purchase`,
//             "high",
//             user.device_token
//           )
//         }
//         if (delivery_type == 'ONLINE') {
//           // user.credits.food = parseFloat(user.credits.food) + parseFloat(tmp_scheduled_bookings[0].orders[0].price)
//           user.first_order = true
//           // await SendUserNotification(
//           //   "Your account is credited",
//           //   "Your account has been credited with " + tmp_scheduled_bookings[0].orders[0].price + " for your first order",
//           //   "high",
//           //   user.device_token
//           // )
//           await user.save()
//         } else {
//           user.first_order = true
//           await user.save()
//         }
//       }

//       await SendUserNotification(
//         "Order has been scheduled",
//         "Your order have been scheduled...",
//         "high",
//         user.device_token
//       )
//       return res.json({
//         status: true,
//         message: "Your order has been placed"
//       })
//     } else {
//       return res.json({
//         status: false,
//         message: "Nothing to save"
//       })
//     }
//   } catch (err) {
//     console.log(err)
//     return res.json({
//       status: false,
//       message: "Sorry something went wrong"
//     })
//   }
// }

exports.confirmScheduledBooking = async (req, res) => {
  try {
    let { errors, isValid } = ValidateUserScheduleBookingConfirm(req.body);
    if (!isValid) {
      return res.json({
        status: false,
        message: errors[0],
      });
    }
    let {
      delivery_type,
      shift_id,
      address_id,
      collectionpoint_id,
      credit_used,
      transaction_id,
      amount,
      coupon,
      discount_price,
      type
    } = req.body;
    if (delivery_type == "ONLINE") {
      let user_address = await Address.findOne({
        user_id: req.payload._id,
        delete_status: false,
        active_location: true,
      });
      let suburb_details = await Suburb.findOne({
        _id: user_address.suburb_id,
      });

      if (suburb_details && suburb_details.has_realtime_order == false) {
        return res.json({
          status: false,
          message: "Delivery not available for your current address",
        });
      }
    }
    let query = [];
    if (delivery_type == "ONLINE") {
      query.push(
        {
          $match: {
            user_id: ObjectId(req.payload._id),
            booking_type: "SCHEDULED",
            delete_status: false,
            quantity: {
              $gt: 0,
            },
            // scheduled_date: {
            //   $gt: new Date()
            // },
            delivery_type: "ONLINE",
            shift_id: ObjectId(shift_id),
            address_id: ObjectId(address_id),
          },
        },
        {
          $lookup: {
            from: "products",
            let: {
              product_id: "$product_id",
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
                  type: 1,
                },
              },
            ],
            as: "product_details",
          },
        },
        {
          $addFields: {
            product_type: {
              $arrayElemAt: ["$product_details", 0],
            },
          },
        },
        {
          $project: {
            _id: 1,
            booking_type: 1,
            scheduled_date: 1,
            coupon: 1,
            bulkorder_status: 1,
            delete_status: 1,
            created_at: 1,
            address_id: 1,
            user_id: 1,
            delivery_type: 1,
            shift_id: 1,
            product_id: 1,
            quantity: 1,
            price: 1,
            orders: 1,
            product_type: "$product_type.type",
          },
        },
        {
          $group: {
            _id: {
              user_id: "$user_id",
              delivery_type: "ONLINE",
              address_id: "$address_id",
              scheduled_date: "$scheduled_date",
              shift_id: "$shift_id",
            },
            total_products: {
              $sum: "$quantity",
            },
            total_price: {
              $sum: {
                $multiply: ["$quantity", "$price"],
              },
            },
            orders: {
              $push: {
                product_id: "$product_id",
                quantity: "$quantity",
                price: "$price",
                type: "$product_type",
              },
            },
          },
        },
        {
          $project: {
            _id: 0,
            user_id: "$_id.user_id",
            delivery_type: "$_id.delivery_type",
            address_id: "$_id.address_id",
            scheduled_date: "$_id.scheduled_date",
            shift_id: "$_id.shift_id",
            total_products: "$total_products",
            total_price: "$total_price",
            orders: "$orders",
          },
        }
      );
    } else {
      query.push(
        {
          $match: {
            user_id: ObjectId(req.payload._id),
            booking_type: "SCHEDULED",
            delete_status: false,
            quantity: {
              $gt: 0,
            },
            delivery_type: "COLLECTIONPOINT",
            shift_id: ObjectId(shift_id),
            collectionpoint_id: ObjectId(collectionpoint_id),
          },
        },
        {
          $group: {
            _id: {
              user_id: "$user_id",
              delivery_type: "COLLECTIONPOINT",
              collectionpoint_id: "$collectionpoint_id",
              scheduled_date: "$scheduled_date",
              shift_id: "$shift_id",
            },
            total_products: {
              $sum: "$quantity",
            },
            total_price: {
              $sum: {
                $multiply: ["$quantity", "$price"],
              },
            },
            orders: {
              $push: {
                product_id: "$product_id",
                quantity: "$quantity",
                price: "$price",
              },
            },
          },
        },
        {
          $project: {
            _id: 0,
            user_id: "$_id.user_id",
            delivery_type: "$_id.delivery_type",
            collectionpoint_id: "$_id.collectionpoint_id",
            address_id: "$_id.address_id",
            scheduled_date: "$_id.scheduled_date",
            shift_id: "$_id.shift_id",
            total_products: "$total_products",
            total_price: "$total_price",
            orders: "$orders",
          },
        }
      );
    }
    query.push({
      $sort: {
        _id: -1,
      },
    });
    let tmp_scheduled_bookings = await TmpBooking.aggregate(query);
    // return res.json({
    //   status: false,
    //   tmp_scheduled_bookings
    // })
    let grand_total_query = query;
    grand_total_query.push({
      $group: {
        _id: null,
        grand_total: {
          $sum: "$total_price",
        },
      },
    });
    let tmp_scheduled_total_amount = await TmpBooking.aggregate(
      grand_total_query
    );
    if (tmp_scheduled_bookings && tmp_scheduled_bookings.length > 0) {
      let user = await User.findOne(
        {
          _id: req.payload._id,
        },
        {
          credits: 1,
          first_order: 1,
          reffered_by: 1,
          name: 1,
          email: 1,
        }
      );
      let last_booking_id = await Booking.findOne(
        {},
        {
          _id: 0,
          booking_id: 1,
        }
      ).sort({ _id: -1 });
      if (last_booking_id) {
        bokid = last_booking_id.booking_id.split("-");
        bk_id = bokid[2];
      } else {
        bk_id = config.SCHEDULED_BOOKING_ID_START;
      }
      let setting = await Settings.findOne();
      let gst = setting.gst;
      let delivery_charge = setting.delivery_charge;
      for (var i = 0; i < tmp_scheduled_bookings.length; i++) {
        let total_item_count = 0;
        let actual_price = 0;
        let discount_price = 0;
        let gst_price = 0;
        let total_price = 0;
        let per_delivery_charge = 0;
        // if (gst) {
        //   gst_price = tmp_scheduled_bookings[i].total_price * (gst / 100)
        // }
        let product_count = 0;
        for (var j = 0; j < tmp_scheduled_bookings[i].orders.length; j++) {
          if (tmp_scheduled_bookings[i].orders[j].type == "FOOD") {
            product_count += tmp_scheduled_bookings[i].orders[j].quantity;
          }
        }
        if (tmp_scheduled_bookings[i].delivery_type == "ONLINE")
          per_delivery_charge = product_count * delivery_charge;

        total_price =
          +tmp_scheduled_bookings[i].total_price +
          +gst_price +
          +per_delivery_charge;
        let coupon_code = null;
        if (coupon) {
          coupon_code = await Coupon.findOne({
            code: coupon,
            delete_status: false,
          });
          if (coupon_code) {
            discount_price = total_price * (coupon_code.val / 100);
            coupon_code.count = coupon_code.count - 1;
            await coupon_code.save();
          }
        }
        // return res.json({
        //   coupon,
        //   coupon_code,
        //   discount_price
        // })

        // if (gst)
        //   gst_price = (parseFloat(total_price) * 100) / (100 + gst)

        let cr_used = 0;
        if (credit_used > 0)
          cr_used = parseFloat(credit_used) / tmp_scheduled_bookings.length;

        let payment = new Payment({
          user_id: req.payload._id,
          date: new Date(moment().format("YYYY-MM-DD")),
          actual_price: tmp_scheduled_bookings[i].total_price,
          discount_price,
          gst: gst_price,
          total_price: total_price - discount_price,
          delivery_charge: per_delivery_charge,
          credit_used: cr_used,
          transaction_id,
        });

        await payment.save();

        let booking_id = `${config.SCHEDULED_BOOKING_ID_PREFIX}${
          parseInt(bk_id) + 1
        }`;
        let order = new Booking();
        order.booking_id = booking_id;
        order.user_id = tmp_scheduled_bookings[i].user_id;
        order.delivery_type = tmp_scheduled_bookings[i].delivery_type;
        order.address_id = tmp_scheduled_bookings[i].address_id;
        order.collectionpoint_id = tmp_scheduled_bookings[i].collectionpoint_id;
        order.scheduled_date = new Date(
          moment(tmp_scheduled_bookings[i].scheduled_date).format("YYYY-MM-DD")
        );
        order.shift_id = tmp_scheduled_bookings[i].shift_id;
        order.orders = tmp_scheduled_bookings[i].orders;
        order.booking_type = "SCHEDULED";
        order.qrcode = await getDataUrl(booking_id);
        bk_id = parseInt(bk_id) + 1;
        order.payment_id = payment._id;
        order.coupon = coupon;

        var saved_order = await order.save();
        if (transaction_id != "") {
          let transaction = new Transaction({
            user_id: req.payload._id,
            payment_id: transaction_id,
            amount: payment.total_price - cr_used,
            gateway: type,
            type: "ORDER",
            booking_id: order.booking_id,
            date: new Date(moment().format("YYYY-MM-DD HH:mm:ss")),
          });
          await transaction.save();
        }
      }
      user.credits.food = user.credits.food - parseFloat(credit_used);
      await user.save();
      if (user.first_order == false) {
        if (user.reffered_by) {
          let reffered_user = await User.findOne({
            _id: user.reffered_by,
          });
          reffered_user.credits.food =
            parseFloat(reffered_user.credits.food) +
            parseFloat(tmp_scheduled_bookings[0].orders[0].price);
          await reffered_user.save();
          await SendUserNotification(
            "Your account is credited",
            `${tmp_scheduled_bookings[0].orders[0].price} $ credited to your account from your referee on his first purchase`,
            "high",
            user.device_token
          );
        }
        if (delivery_type == "ONLINE") {
          user.first_order = true;
          await user.save();
        } else {
          user.first_order = true;
          await user.save();
        }
      }

      await SendUserNotification(
        "Order has been scheduled",
        "Your order have been scheduled...",
        "high",
        user.device_token
      );

      await neworder_confirmed({
        name: user.name,
        to_email: user.email,
        order_id: saved_order._id,
      });
      return res.json({
        status: true,
        message: "Your order has been placed",
      });
    } else {
      return res.json({
        status: false,
        message: "Nothing to save",
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

exports.scheduleBookingList = async (req, res) => {
  try {
    let scheduled_bookings = await bookings.aggregate([
      {
        $match: {
          user_id: ObjectId(req.payload._id),
          booking_type: "SCHEDULED",
          delete_status: false,
        },
      },
      {
        $lookup: {
          from: "settings",
          let: { shift_id: "$shift_id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $in: ["$$shift_id", "$shift_times._id"],
                },
              },
            },
            {
              $project: {
                _id: 0,
                shift: {
                  $filter: {
                    input: "$shift_times",
                    as: "shift",
                    cond: {
                      $eq: ["$$shift._id", "$$shift_id"],
                    },
                  },
                },
              },
            },
          ],
          as: "shift_details",
        },
      },
      {
        $lookup: {
          from: "addresses",
          let: { address_id: "$address_id" },
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
                created_at: 1,
                active_location: 1,
                updated_at: 1,
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
        $lookup: {
          from: "collectionpoints",
          let: { collectionpoint_id: "$collectionpoint_id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: ["$_id", "$$collectionpoint_id"],
                },
              },
            },
            {
              $project: {
                name: 1,
                contact_name: 1,
                email: 1,
                mobile: 1,
                image: 1,
              },
            },
          ],
          as: "collectionpoint",
        },
      },
      // {
      //   $lookup: {
      //     from: 'products',
      //     let: {
      //       orders: "$orders",
      //     },
      //     pipeline: [
      //       {
      //         $match: {
      //           $expr: {
      //             $in: ["$_id", "$$orders.product_id"]
      //           }
      //         }
      //       },
      //       {
      //         $project: {
      //           _id: 1,
      //           cover_pic: 1,
      //           name: 1,
      //           description: 1,
      //           image: 1,
      //         },
      //       },
      //     ],
      //     as: "products"
      //   }
      // },
      {
        $unwind: "$orders",
      },
      {
        $lookup: {
          from: "products",
          localField: "orders.product_id",
          foreignField: "_id",
          as: "product",
        },
      },
      {
        $project: {
          _id: 1,
          scheduled_date: 1,
          created_at: 1,
          booking_id: 1,
          user_id: 1,
          delivery_type: 1,
          redeemed: 1,
          address: {
            $arrayElemAt: ["$address", 0],
          },
          collection_point: {
            $arrayElemAt: ["$collectionpoint", 0],
          },
          orders: {
            _id: "$orders._id",
            product: {
              $arrayElemAt: ["$product", 0],
            },
            quantity: "$orders.quantity",
          },
          qrcode: 1,
          shift: {
            $arrayElemAt: [
              {
                $arrayElemAt: ["$shift_details.shift", 0],
              },
              0,
            ],
          },
        },
      },
      {
        $group: {
          _id: {
            _id: "$_id",
            scheduled_date: "$scheduled_date",
            created_at: "$created_at",
            booking_id: "$booking_id",
            user_id: "$user_id",
            delivery_type: "$delivery_type",
            qrcode: "$qrcode",
            address: "$address",
            shift: "$shift",
            redeemed: "$redeemed",
            collection_point: "$collection_point",
          },
          orders: {
            $push: "$orders",
          },
        },
      },
      {
        $project: {
          _id: "$_id._id",
          scheduled_date: "$_id.scheduled_date",
          created_at: "$_id.created_at",
          booking_id: "$_id.booking_id",
          delivery_type: "$_id.delivery_type",
          qrcode: "$_id.qrcode",
          address: "$_id.address",
          shift: "$_id.shift",
          redeemed: "$_id.redeemed",
          clooection_point: "$_id.collection_point",
          orders: "$orders",
        },
      },
    ]);
    return res.json({
      status: true,
      data: scheduled_bookings,
    });
  } catch (err) {
    console.log(err);
    return res.json({ status: false, message: "Sorry something went wrong" });
  }
};

exports.scheduledBookingCart = async (req, res) => {
  try {
    let { errors, isValid } = ValidateUserScheduledCartList(req.query);
    if (!isValid) {
      return res.json({
        status: false,
        message: errors[0],
      });
    }
    let { shift_id, delivery_type, address_id, collectionpoint_id } = req.query;
    let query = [];
    if (delivery_type == "ONLINE") {
      query.push(
        {
          $match: {
            user_id: ObjectId(req.payload._id),
            shift_id: ObjectId(shift_id),
            delivery_type,
            address_id: ObjectId(address_id),
          },
        },
        {
          $lookup: {
            from: "addresses",
            localField: "address_id",
            foreignField: "_id",
            as: "address",
          },
        }
      );
    } else {
      query.push(
        {
          $match: {
            user_id: ObjectId(req.payload._id),
            shift_id: ObjectId(shift_id),
            delivery_type,
            collectionpoint_id: ObjectId(collectionpoint_id),
          },
        },
        {
          $lookup: {
            from: "collectionpoints",
            localField: "collectionpoint_id",
            foreignField: "_id",
            as: "collection_point",
          },
        }
      );
    }
    query.push(
      {
        $lookup: {
          from: "products",
          localField: "product_id",
          foreignField: "_id",
          as: "product",
        },
      },
      {
        $project: {
          _id: 1,
          scheduled_date: 1,
          created_at: 1,
          collectionpoint_id: 1,
          delivery_type: 1,
          shift_id: 1,
          product_id: 1,
          quantity: 1,
          collection_point: {
            $arrayElemAt: ["$collection_point", 0],
          },
          address: {
            $arrayElemAt: ["$address", 0],
          },
          product: {
            $arrayElemAt: ["$product", 0],
          },
        },
      },
      {
        $project: {
          _id: 1,
          scheduled_date: 1,
          created_at: 1,
          collectionpoint_id: 1,
          delivery_type: 1,
          shift_id: 1,
          product_id: 1,
          quantity: 1,
          collection_point: {
            _id: 1,
            name: 1,
            contact_name: 1,
            email: 1,
            mobile: 1,
          },
          address: {
            _id: 1,
            location: 1,
            address_type: 1,
            address_line1: 1,
            house_flat_no: 1,
            appartment: 1,
            landmark: 1,
            to_reach: 1,
            contact_person: 1,
          },
          product: {
            _id: 1,
            cover_pic: 1,
            type: 1,
            name: 1,
            price: 1,
            description: 1,
            image: 1,
          },
        },
      }
    );
    let scheduledCart = await TmpBooking.aggregate(query);
    return res.json({
      status: true,
      data: scheduledCart,
    });
  } catch (err) {
    console.log(err);
    return res.json({
      status: false,
      message: "Sorry something went wrong",
    });
  }
};

exports.clearScheduledCart = async (req, res) => {
  try {
    await TmpBooking.deleteMany({
      booking_type: "SCHEDULED",
      user_id: req.payload._id,
    });
    return res.json({
      status: true,
      message: "Booking cart has been cleared",
    });
  } catch (err) {
    console.log(err);
    return res.json({
      status: false,
      message: "sorry something went wrong",
    });
  }
};

exports.listMyOrders = async (req, res) => {
  try {
    let { page, limit } = req.query;
    let skip = 0;
    if (typeof limit === "undefined") limit = 10;
    if (typeof page === "undefined") page = 1;
    if (page > 1) {
      skip = (page - 1) * limit;
    }
    let today = moment().format("YYYY-MM-DD");
    let tomorrow = moment().add(1, "days").format("YYYY-MM-DD");
    let current_slot = await Settings.aggregate([
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
            $and: [
              // { $gte: [new Date(), "$start"] },
              { $lte: [new Date(), "$end"] },
            ],
          },
        },
      },
      {
        $sort: {
          start: 1,
        },
      },
      {
        $group: {
          _id: null,
          shift_ids: {
            $push: "$_id",
          },
        },
      },
    ]);
    // return res.json({
    //   current_slot
    // })
    let shift_ids = [];
    if (current_slot.length > 0) {
      shift_ids = current_slot[0].shift_ids;
    }
    let query = [
      {
        $match: {
          user_id: ObjectId(req.payload._id),
          delete_status: false,
          booking_type: {
            $ne: "BULK",
          },
          scheduled_date: {
            $lte: new Date(moment().format("YYYY-MM-DD")),
          },
        },
      },
      {
        $lookup: {
          from: "settings",
          let: { shift_id: "$shift_id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $in: ["$$shift_id", "$shift_times._id"],
                },
              },
            },
            {
              $project: {
                _id: 0,
                shift: {
                  $filter: {
                    input: "$shift_times",
                    as: "shift",
                    cond: {
                      $eq: ["$$shift._id", "$$shift_id"],
                    },
                  },
                },
              },
            },
          ],
          as: "shift_details",
        },
      },
      {
        $addFields: {
          shift_details: {
            $arrayElemAt: [
              {
                $arrayElemAt: ["$shift_details.shift", 0],
              },
              0,
            ],
          },
        },
      },
      {
        $unwind: "$orders",
      },
      {
        $lookup: {
          from: "products",
          let: { product_id: "$orders.product_id" },
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
        $lookup: {
          from: "collectionpoints",
          let: {
            collectionpoint_id: "$collectionpoint_id",
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: ["$_id", "$$collectionpoint_id"],
                },
              },
            },
            {
              $project: {
                _id: 1,
                name: 1,
                contact_name: 1,
                email: 1,
                mobile: 1,
              },
            },
            {
              $lookup: {
                from: "addresses",
                let: {
                  c_id: "$_id",
                },
                pipeline: [
                  {
                    $match: {
                      $expr: {
                        $eq: ["$collectionpoint_id", "$$c_id"],
                      },
                    },
                  },
                  {
                    $project: {
                      _id: 1,
                      location: 1,
                      address_line1: 1,
                      address_line2: 1,
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
          ],
          as: "collection_point",
        },
      },
      {
        $addFields: {
          collection_point: {
            $arrayElemAt: ["$collection_point", 0],
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
                active_location: 1,
                address_line1: 1,
                house_flat_no: 1,
                appartment: 1,
                landmark: 1,
                to_reach: 1,
                contact_person: 1,
                address_line2: 1,
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
        $project: {
          _id: 1,
          booking_type: 1,
          delete_status: 1,
          created_at: 1,
          booking_id: 1,
          payment_id: 1,
          user_id: 1,
          delivery_type: 1,
          shift_id: 1,
          qrcode: 1,
          redeemed: 1,
          scheduled_date: 1,
          delivery_address: 1,
          collection_point: 1,
          shift_details: 1,
          order_details: {
            _id: "$product_details._id",
            cover_pic: "$product_details.cover_pic",
            type: "$product_details.type",
            allergen_contents: "$product_details.allergen_contents",
            delete_status: "$product_details.delete_status",
            name: "$product_details.name",
            price: "$orders.price",
            description: "$product_details.description",
            image: "$product_details.image",
            is_veg: "$product_details.is_veg",
            is_regular: "$product_details.is_regular",
            quantity: "$orders.quantity",
          },
        },
      },
      {
        $group: {
          _id: {
            _id: "$_id",
            booking_type: "$booking_type",
            delete_status: "$delete_status",
            created_at: "$created_at",
            booking_id: "$booking_id",
            payment_id: "$payment_id",
            user_id: "$user_id",
            delivery_type: "$delivery_type",
            shift_id: "$shift_id",
            qrcode: "$qrcode",
            redeemed: "$redeemed",
            delivery_address: "$delivery_address",
            scheduled_date: "$scheduled_date",
            collection_point: "$collection_point",
            shift_details: "$shift_details",
          },
          orders: {
            $push: "$order_details",
          },
        },
      },
      {
        $project: {
          _id: "$_id._id",
          booking_type: "$_id.booking_type",
          booking_id: "$_id.booking_id",
          payment_id: "$_id.payment_id",
          delivery_type: "$_id.delivery_type",
          scheduled_date: "$_id.scheduled_date",
          qrcode: "$_id.qrcode",
          redeemed: "$_id.redeemed",
          delivery_address: "$_id.delivery_address",
          collection_point: "$_id.collection_point",
          shift_details: "$_id.shift_details",
          order_details: "$orders",
          food_time: "$_id.shift_details.name",
          expired: {
            $cond: {
              if: {
                $and: [
                  { $in: ["$_id.shift_details._id", shift_ids] },
                  {
                    $eq: [
                      "$_id.scheduled_date",
                      new Date(moment().format("YYYY-MM-DD")),
                    ],
                  },
                ],
              },
              then: false,
              else: true,
            },
          },
        },
      },
      {
        $lookup: {
          from: "ratings",
          let: {
            booking_id: "$_id",
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: ["$booking_id", "$$booking_id"],
                },
              },
            },
          ],
          as: "rated",
        },
      },
      {
        $addFields: {
          rated: {
            $cond: {
              if: {
                $gt: [{ $size: "$rated" }, 0],
              },
              then: true,
              else: false,
            },
          },
        },
      },
      {
        $sort: {
          scheduled_date: -1,
        },
      },
    ];
    let orders = await Booking.aggregate([
      ...query,
      {
        $skip: skip,
      },
      {
        $limit: limit,
      },
    ]);
    let itemCount = await Booking.aggregate([
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
      orders,
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

exports.bulkBooking = async (req, res) => {
  try {
    let { errors, isValid } = ValidateUserBulkBooking(req.body);
    if (!isValid) {
      return res.json({
        status: false,
        message: errors[0],
      });
    }
    let {
      products,
      quantities,
      scheduled_date,
      scheduled_time,
      address,
      contact_person,
      lat,
      lng,
      contact_number,
      approximate_price,
    } = req.body;
    if (products.length == 0) {
      return res.json({
        status: false,
        message: "Products and quantities required",
      });
    }
    if (products.length != quantities.length) {
      return res.json({
        status: false,
        message: "Products and quantities doesn't match",
      });
    }
    let save_address = new Address({
      user_id: req.payload._id,
      type: "BULK",
      location: {
        coordinates: [parseFloat(lng), parseFloat(lat)],
      },
      address_line1: address,
      contact_person: contact_person,
      contact_number: contact_number,
      address_type: "OTHERS",
    });
    let saved_address = await save_address.save();
    let orders = [];
    for (var i = 0; i < products.length; i++) {
      let details = {
        product_id: products[i],
        quantity: quantities[i],
      };
      orders.push(details);
    }
    let tmp_booking = new TmpBooking({
      user_id: req.payload._id,
      booking_type: "BULK",
      address_id: saved_address._id,
      scheduled_date: new Date(moment(scheduled_date).format("YYYY-MM-DD")),
      scheduled_time: scheduled_time,
      orders: orders,
      approximate_price: approximate_price,
    });
    let user = await User.findOne({
      _id: req.payload._id,
    });
    await tmp_booking.save();
    await SendUserNotification(
      "Bulk Order Placed",
      "We will contact you soon...",
      "high",
      user.device_token
    );
    return res.json({
      status: true,
      message: "We will contact you soon,.",
    });
  } catch (err) {
    console.log(err);
    return res.json({
      status: false,
      message: "Sorry something went wrong",
    });
  }
};

exports.bulkProducts = async (req, res) => {
  try {
    let products = await Product.find(
      {
        delete_status: false,
        type: "FOOD",
      },
      {
        name: 1,
        image: 1,
        cover_pic: 1,
        description: 1,
        price: 1,
        allergen_contents: 1,
        is_veg: 1,
        is_regular: 1,
      }
    );
    return res.json({
      status: true,
      data: products,
    });
  } catch (err) {
    console.log(err);
    return res.json({
      status: false,
      message: "Sorry something went wrong",
    });
  }
};

exports.updateFirebaseToken = async (req, res) => {
  try {
    let { errors, isValid } = ValidateUserFireBaseToken(req.body);
    if (!isValid) {
      return res.json({
        status: false,
        message: errors[0],
      });
    }
    let { device_token } = req.body;
    await User.updateOne(
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

exports.getNotifications = async (req, res) => {
  try {
    let { page, limit } = req.query;
    let skip = 0;
    if (typeof limit === "undefined") limit = 5;
    if (typeof page === "undefined") page = 1;
    if (page > 1) {
      skip = (page - 1) * limit;
    }
    let user_address = await Address.findOne({
      user_id: ObjectId(req.payload._id),
      type: "USER",
      active_location: true,
      delete_status: false,
    });
    let query = [
      {
        $match: {
          delete_status: false,
          $expr: {
            $in: [user_address.suburb_id, "$suburbs"],
          },
        },
      },
      {
        $project: {
          created_at: 1,
          title: 1,
          description: 1,
        },
      },
      {
        $sort: {
          _id: -1,
        },
      },
    ];
    let notifications = [];
    if (user_address) {
      notifications = await Notification.aggregate([
        ...query,
        {
          $skip: skip,
        },
        {
          $limit: limit,
        },
      ]);
      let itemCount = await Notification.aggregate([
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
    } else {
      return res.json({
        status: true,
        data: {},
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

exports.markAddressActive = async (req, res) => {
  try {
    let { errors, isValid } = ValidateUserAddressActive(req.body);
    if (!isValid) {
      return res.json({
        status: false,
        message: errors[0],
      });
    }
    let { _id } = req.body;
    await Address.updateOne(
      {
        _id,
        user_id: req.payload._id,
      },
      {
        $set: {
          active_location: true,
        },
      }
    );
    await Address.updateMany(
      {
        user_id: req.payload._id,
        _id: {
          $ne: _id,
        },
      },
      {
        active_location: false,
      }
    );
    return res.json({
      status: true,
      message: "Location activated",
    });
  } catch (err) {
    console.log(err);
    return res.json({
      status: false,
      message: "Sorry something went wrong",
    });
  }
};

exports.home = async (req, res) => {
  try {
    let { shifts, coming_shift } = await this.getComingShift();
    console.log(coming_shift);
    let query = [
      {
        $match: {
          is_regular: true,
          delete_status: false,
          type: "FOOD",
        },
      },
    ];
    let data = {};
    if (req.payload) {
      let active_address = await Address.findOne(
        {
          user_id: req.payload._id,
          delete_status: false,
          active_location: true,
        },
        {
          created_at: 0,
          updates_at: 0,
          delete_status: 0,
          __v: 0,
        }
      );
      if (!active_address) {
        return res.json({
          status: false,
          message: "Please add your address details to continue",
        });
      }

      // ****************************************************find Drivers with including address suburb
      let driverStocks = await Stock.aggregate([
        {
          $match: {
            suburb_id: active_address.suburb_id,
            shift_id: ObjectId(coming_shift),
            type: "DELIVERY",
            date: new Date(moment().format("YYYY-MM-DD")),
            delete_status: false,
            transfer_status: false,
          },
        },
        {
          $project: {
            driver_id: 1,
          },
        },
        {
          $group: {
            _id: null,
            drivers: {
              $push: "$driver_id",
            },
          },
        },
      ]);
      // return res.json({driverStocks})
      let driverArray = [];
      if (driverStocks.length) {
        driverArray = driverStocks[0].drivers;
      }
      query.push(
        {
          $lookup: {
            from: "stocks",
            let: {
              shift_id: ObjectId(coming_shift),
              product_id: "$_id",
              suburb_id: active_address.suburb_id,
              driver_ids: driverArray,
            },
            pipeline: [
              {
                $match: {
                  type: "DELIVERY",
                  date: new Date(moment().format("YYYY-MM-DD")),
                  $expr: {
                    $and: [
                      {
                        $eq: ["$$shift_id", "$shift_id"],
                      },
                      {
                        $in: ["$$product_id", "$products.product_id"],
                      },
                      // {
                      //   $eq: ["$suburb_id", "$$suburb_id"]
                      // },
                      {
                        $in: ["$driver_id", "$$driver_ids"],
                      },
                    ],
                  },
                },
              },
            ],
            as: "stocks",
          },
        },
        {
          $unwind: {
            path: "$stocks",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $project: {
            _id: 1,
            cover_pic: 1,
            name: 1,
            price: 1,
            description: 1,
            image: 1,
            stocks: 1,
            is_veg: 1,
            allergen_contents: 1,
            ingredients: 1,
            stock_details: {
              $filter: {
                // input: "$stocks.products",
                input: "$stocks.initial_stock",
                as: "stock",
                cond: {
                  $eq: ["$$stock.product_id", "$_id"],
                },
              },
            },
          },
        },
        {
          $project: {
            _id: 1,
            cover_pic: 1,
            name: 1,
            price: 1,
            description: 1,
            image: 1,
            is_veg: 1,
            allergen_contents: 1,
            ingredients: 1,
            delivery_stock: {
              $arrayElemAt: ["$stock_details", 0],
            },
          },
        },
        {
          $group: {
            _id: {
              _id: "$_id",
              cover_pic: "$cover_pic",
              name: "$name",
              price: "$price",
              description: "$description",
              image: "$image",
              allergen_contents: "$allergen_contents",
              ingredients: "$ingredients",
            },
            details: {
              $push: {
                is_veg: "$is_veg",
              },
            },
            total_delivery_stock: {
              $sum: "$delivery_stock.stock",
            },
          },
        },
        {
          $project: {
            _id: "$_id._id",
            cover_pic: "$_id.cover_pic",
            name: "$_id.name",
            price: "$_id.price",
            description: "$_id.description",
            image: "$_id.image",
            allergen_contents: "$_id.allergen_contents",
            ingredients: "$_id.ingredients",
            is_veg: {
              $arrayElemAt: ["$details", 0],
            },
            total_delivery_stock: "$total_delivery_stock",
          },
        },
        {
          $project: {
            _id: 1,
            cover_pic: 1,
            name: 1,
            price: 1,
            description: 1,
            image: 1,
            is_veg: "$is_veg.is_veg",
            total_delivery_stock: 1,
            allergen_contents: 1,
            ingredients: 1,
          },
        },

        /////////////////////////Count checking with orders ///////////////////////////////////////////
        {
          $lookup: {
            from: "bookings",
            let: {
              product_id: "$_id",
              suburb_id: active_address.suburb_id,
            },
            pipeline: [
              {
                $match: {
                  scheduled_date: new Date(moment().format("YYYY-MM-DD")),
                  delivery_type: "ONLINE",
                  shift_id: ObjectId(coming_shift),
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
                $match: {
                  "address.suburb_id": active_address.suburb_id,
                },
              },
              {
                $unwind: "$orders",
              },
              {
                $match: {
                  $expr: {
                    $eq: ["$orders.product_id", "$$product_id"],
                  },
                },
              },
              {
                $project: {
                  orders: 1,
                },
              },
              {
                $group: {
                  _id: null,
                  tot_quantity: {
                    $sum: "$orders.quantity",
                  },
                },
              },
            ],
            as: "booked_orders",
          },
        },
        {
          $addFields: {
            booked_orders: {
              $arrayElemAt: ["$booked_orders", 0],
            },
          },
        },
        {
          $project: {
            _id: 1,
            cover_pic: 1,
            name: 1,
            price: 1,
            description: 1,
            image: 1,
            allergen_contents: 1,
            is_veg: 1,
            // booked_orders: 1,
            total_delivery_stock: 1,
            ingredients: 1,
            stock_left: {
              $subtract: [
                "$total_delivery_stock",
                "$booked_orders.tot_quantity",
              ],
            },
          },
        },
        {
          $addFields: {
            total_delivery_stock: {
              $cond: {
                if: {
                  $eq: ["$stock_left", null],
                },
                then: "$total_delivery_stock",
                else: "$stock_left",
              },
            },
          },
        },
        {
          $lookup: {
            from: "collectionpoints",
            let: {
              suburb_id: active_address.suburb_id,
              product_id: "$_id",
            },
            pipeline: [
              {
                $lookup: {
                  from: "addresses",
                  let: {
                    // suburb_id: "$$suburb_id",
                    collectionpoint_id: "$_id",
                  },
                  pipeline: [
                    {
                      $match: {
                        $expr: {
                          $and: [
                            // {
                            //   $eq: ['$suburb_id', "$$suburb_id"]
                            // },
                            {
                              $eq: [
                                "$collectionpoint_id",
                                "$$collectionpoint_id",
                              ],
                            },
                          ],
                        },
                      },
                    },
                    {
                      $project: {
                        suburb_id: 1,
                      },
                    },
                  ],
                  as: "address",
                },
              },
              {
                $unwind: "$address",
              },
              {
                $project: {
                  name: 1,
                  suburb_id: "$address.suburb_id",
                },
              },
              {
                $lookup: {
                  from: "cp_stocks",
                  let: {
                    collectionpoint_id: "$_id",
                  },
                  pipeline: [
                    {
                      $match: {
                        date: new Date(moment().format("YYYY-MM-DD")),
                        shift_id: ObjectId(coming_shift),
                        delete_status: false,
                        $expr: {
                          $eq: ["$collectionpoint_id", "$$collectionpoint_id"],
                        },
                      },
                    },
                    {
                      $unwind: "$products",
                    },
                    {
                      $match: {
                        $expr: {
                          $eq: ["$products.product_id", "$$product_id"],
                        },
                      },
                    },
                    {
                      $project: {
                        products: 1,
                        collectionpoint_id: 1,
                      },
                    },
                  ],
                  as: "collectionpoint_stocks",
                },
              },
              {
                $addFields: {
                  collectionpoint_stocks: {
                    $arrayElemAt: ["$collectionpoint_stocks", 0],
                  },
                },
              },
              {
                $project: {
                  product_id: "$collectionpoint_stocks.products.product_id",
                  stock: "$collectionpoint_stocks.products.stock",
                  collectionpoint_id:
                    "$collectionpoint_stocks.collectionpoint_id",
                },
              },
              {
                $group: {
                  _id: null,
                  cp_ids: {
                    $push: "$collectionpoint_id",
                  },
                  cp_stock: {
                    $sum: "$stock",
                  },
                },
              },
            ],
            as: "collection_points",
          },
        },
        {
          $addFields: {
            collection_points: {
              $arrayElemAt: ["$collection_points", 0],
            },
          },
        },
        {
          $project: {
            cover_pic: 1,
            name: 1,
            price: 1,
            description: 1,
            ingredients: 1,
            image: 1,
            allergen_contents: 1,
            total_delivery_stock: {
              $cond: {
                if: {
                  $lte: ["$total_delivery_stock", 0],
                },
                then: 0,
                else: "$total_delivery_stock",
              },
            },
            total_cp_stock: "$collection_points.cp_stock",
            cp_ids: "$collection_points.cp_ids",
            is_veg: 1,
          },
        },
        {
          $addFields: {
            total_delivery_stock: {
              $add: ["$total_delivery_stock", "$total_cp_stock"],
            },
          },
        },
        {
          $sort: {
            name: 1,
          },
        }
        ///////////////////////////////Count check orders with colllection point//////////////////////////////
        // {
        //   $lookup: {
        //     from: 'bookings',
        //     let: {
        //       product_id: "$_id",
        //       suburb_id: active_address.suburb_id,
        //       cp_ids: "$cp_ids"
        //     },
        //     pipeline: [
        //       {
        //         $match: {
        //           scheduled_date: new Date(moment().format('YYYY-MM-DD')),
        //           delivery_type: 'COLLECTIONPOINT',
        //           shift_id: ObjectId(coming_shift),
        //           $expr: {
        //             $in: ["$collectionpoint_id", "$$cp_ids"]
        //           }
        //         }
        //       },
        //       {
        //         $unwind: "$orders"
        //       },
        //       {
        //         $match: {

        //         }
        //       }
        //     ],
        //     as: "cp_bookings"
        //   }
        // },
      );
      let user = await User.findOne({
        _id: req.payload._id,
      });
      let coupons = await Coupon.find(
        {
          count: {
            $gt: 0,
          },
          active_status: true,
          suburb_id: active_address.suburb_id,
          delete_status: false,
        },
        {
          name: 1,
          val: 1,
          code: 1,
          image: 1,
        }
      );
      data.user_details = user.toAuthJSON();
      data.active_address = active_address;
      data.coupons = coupons;
    } else {
      query.push({
        $addFields: {
          total_delivery_stock: 0,
          total_cp_stock: 0,
        },
      });
    }
    let settings = await Settings.findOne(
      {},
      {
        _id: 0,
        shift_times: 1,
        min_bulk_order_quantity: 1,
        gst: 1,
        delivery_charge: 1,
        service_charge_paypal: 1,
        service_charge_square: 1,
      }
    ).lean();

    let products = await Product.aggregate(query);
    // return res.json({
    //   products
    // })
    let shift = await Settings.findOne(
      { "shift_times._id": ObjectId(coming_shift) },
      { shift_times: { $elemMatch: { _id: ObjectId(coming_shift) } } }
    );
    if (shift) {
      data.current_shift = shift.shift_times[0];
    } else {
      data.current_shift = {
        _id: "0",
        name: "Shift will start soon",
        duration: 0,
        time: "00:00 am",
      };
    }

    if (req.payload) {
      let active_address = await Address.findOne(
        {
          user_id: req.payload._id,
          delete_status: false,
          active_location: true,
        },
        {
          created_at: 0,
          updates_at: 0,
          delete_status: 0,
          __v: 0,
        }
      );
      let subrubDetails = await Suburb.findOne({
        _id: active_address.suburb_id,
        // has_online_delivery: {
        //   $in: [ data.current_shift._id]
        // }
      });

      settings.shift_times.forEach((shift_time) => {
        shift_time.has_schedule_delivery = subrubDetails.has_realtime_order;
        if (subrubDetails.has_online_delivery.includes(shift_time._id)) {
          shift_time.has_realtime_delivery = true;
        } else {
          // shift_time.has_realtime_delivery = false; // original
          shift_time.has_realtime_delivery = true; // temporary solutyion
        }
      })

      // return res.json(subrubDetails)
      settings.has_schedule_delivery = subrubDetails.has_realtime_order;
      // settings.has_realtime_delivery = subrubDetails.has_online_delivery
      if (subrubDetails.has_online_delivery.includes(data.current_shift._id)) {
        settings.has_realtime_delivery = true;
      } else {
        settings.has_realtime_delivery = false;
      }
    }
    data.settings = settings;
    data.products = products;

    let banner = await Banner.find(
      { delete_status: false, type: "USERAPP" },
      { created_at: 0, delete_status: 0, _id: 0, __v: 0, type: 0 }
    );
    data.banners = banner;
    return res.json({
      status: true,
      data,
      // data: products
    });
  } catch (err) {
    console.log(err);
    return res.json({
      status: false,
      message: "Sorry something went wrong",
    });
  }
};

exports.scheduledOrdersList = async (req, res) => {
  try {
    let { errors, isValid } = ValidateScheduledOrderList(req.query);
    if (!isValid) {
      return res.json({
        status: false,
        message: errors[0],
      });
    }
    let { delivery_type } = req.query;
    let today = moment().format("YYYY-MM-DD");
    let scheduled_orders = await Booking.aggregate([
      {
        $match: {
          user_id: ObjectId(req.payload._id),
          booking_type: "SCHEDULED",
          delete_status: false,
          scheduled_date: {
            $gte: new Date(moment().format("YYYY-MM-DD")),
          },
          company_id: {
            $eq: null,
          },
          delivery_type,
          redeemed: false,
        },
      },
      {
        $lookup: {
          from: "settings",
          let: { shift_id: "$shift_id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $in: ["$$shift_id", "$shift_times._id"],
                },
              },
            },
            {
              $project: {
                _id: 0,
                shift: {
                  $filter: {
                    input: "$shift_times",
                    as: "shift",
                    cond: {
                      $eq: ["$$shift._id", "$$shift_id"],
                    },
                  },
                },
              },
            },
          ],
          as: "shift_details",
        },
      },
      {
        $addFields: {
          shift_details: {
            $arrayElemAt: [
              {
                $arrayElemAt: ["$shift_details.shift", 0],
              },
              0,
            ],
          },
        },
      },
      {
        $lookup: {
          from: "addresses",
          let: { address_id: "$address_id" },
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
                created_at: 1,
                active_location: 1,
                updated_at: 1,
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
        $addFields: {
          address: {
            $arrayElemAt: ["$address", 0],
          },
        },
      },
      {
        $lookup: {
          from: "collectionpoints",
          let: { collectionpoint_id: "$collectionpoint_id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: ["$_id", "$$collectionpoint_id"],
                },
              },
            },
            {
              $project: {
                _id: 1,
                name: 1,
                contact_name: 1,
                email: 1,
                mobile: 1,
                image: 1,
              },
            },
            {
              $lookup: {
                from: "addresses",
                let: {
                  c_id: "$_id",
                },
                pipeline: [
                  {
                    $match: {
                      $expr: {
                        $eq: ["$collectionpoint_id", "$$c_id"],
                      },
                    },
                  },
                  {
                    $project: {
                      _id: 1,
                      location: 1,
                      address_line1: 1,
                      address_line2: 1,
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
          ],
          as: "collectionpoint",
        },
      },
      {
        $addFields: {
          collectionpoint: {
            $arrayElemAt: ["$collectionpoint", 0],
          },
        },
      },
      {
        $unwind: "$orders",
      },
      {
        $lookup: {
          from: "products",
          let: {
            order_id: "$orders.product_id",
            quantity: "$orders.quantity",
            price: "$orders.price",
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: ["$_id", "$$order_id"],
                },
              },
            },
            {
              $project: {
                name: 1,
                image: 1,
                cover_pic: 1,
                description: 1,
                type: 1,
                allergen_contents: 1,
                is_veg: 1,
              },
            },
            {
              $addFields: {
                price: "$$price",
                quantity: "$$quantity",
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
        $group: {
          _id: {
            _id: "$_id",
            scheduled_date: "$scheduled_date",
            created_at: "$created_at",
            booking_id: "$booking_id",
            user_id: "$user_id",
            delivery_type: "$delivery_type",
            qrcode: "$qrcode",
            address: "$address",
            collectionpoint: "$collectionpoint",
            shift_details: "$shift_details",
            redeemed: "$redeemed",
            // collection_point: "$collection_point",
          },
          orders: {
            $push: "$orders",
          },
        },
      },
      {
        $project: {
          _id: "$_id._id",
          _id: "$_id._id",
          scheduled_date: "$_id.scheduled_date",
          created_at: "$_id.created_at",
          booking_id: "$_id.booking_id",
          delivery_type: "$_id.delivery_type",
          qrcode: "$_id.qrcode",
          address: "$_id.address",
          shift_details: "$_id.shift_details",
          redeemed: "$_id.redeemed",
          collection_point: "$_id.collectionpoint",
          orders: "$orders",
        },
      },
      {
        $sort: {
          scheduled_date: 1,
        },
      },
    ]);
    return res.json({
      status: true,
      data: scheduled_orders,
    });
  } catch (err) {
    console.log(err);
    return res.json({
      status: false,
      message: "Sorry something went wrong",
    });
  }
};

exports.cancelScheduledOrder = async (req, res) => {
  try {
    let { _id } = req.body;
    if (typeof _id === "undefined") {
      return res.json({
        status: false,
        message: "Id is required",
      });
    }
    let booking = await Booking.findOne({
      _id,
      booking_type: "SCHEDULED",
      user_id: req.payload._id,
      delete_status: false,
      redeemed: false,
      // scheduled_date: {
      //   $gte: new Date(moment().format('YYYY-MM-DD'))
      // }
    }).populate("payment_id");
    // return res.json({booking})
    if (booking) {
      var end = moment().endOf("day");
      let today = moment().format("YYYY-MM-DD");
      let tomorrow = moment().add(1, "days").format("YYYY-MM-DD");
      let shift_details = await Settings.aggregate([
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
            _id: ObjectId(booking.shift_id),
          },
        },
      ]);
      if (booking.scheduled_date == moment(new Date()).format("YYYY-MM-DD")) {
        if ((shift_details[0].start - new Date()) / 3600000 <= 6) {
          return res.json({
            status: false,
            message: "Scheduled order can only edit befor 6 hours",
          });
        }
      }
      // if (((shift_details[0].start - new Date()) / 3600000) > 4) {
      let total_credits = 0;
      //   total_orders = 0
      // for (var i = 0; i < booking.orders.length; i++) {
      //   total_credits += booking.orders[i].price * booking.orders[i].quantity
      //   total_orders += booking.orders[i].quantity
      // }
      let user = await User.findOne({
        _id: req.payload._id,
      });
      // user.credits.food = user.credits.food + total_credits
      user.credits.food += booking.payment_id.total_price;
      await user.save();
      await Payment.deleteOne({
        _id: booking.payment_id._id,
      });
      await booking.delete();
      return res.json({
        status: true,
        message: "Scheduled order has been cancelled",
      });
      // } else {
      // return res.json({
      // status: false,
      // message: "Orders can only cancelled before 4 hours"
      // })
      // }
    } else {
      return res.json({
        status: false,
        message: "Order not found",
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

exports.updateScheduleBooking = async (req, res) => {
  try {
    let { errors, isValid } = ValidateUserScheduledBookingUpdate(req.body);
    if (!isValid) {
      return res.json({
        status: false,
        message: errors[0],
      });
    }
    let {
      _id,
      delivery_type,
      shift_id,
      address_id,
      collectionpoint_id,
      credit_used,
      transaction_id,
      amount,
      products,
      quantities,
      prices,
      type
    } = req.body;
    console.log(req.body)
    let general = await Settings.findOne({});
    let booking = await Booking.findOne({
      _id,
      booking_type: "SCHEDULED",
      user_id: req.payload._id,
      redeemed: false,
      delete_status: false,
    });
    if (booking) {
      var end = moment().endOf("day");
      let today = moment().format("YYYY-MM-DD");
      let tomorrow = moment().add(1, "days").format("YYYY-MM-DD");
      let shift_details = await Settings.aggregate([
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
            _id: ObjectId(booking.shift_id),
          },
        },
      ]);
      let total_credits = 0;
      let total_quantity = 0;
      for (var i = 0; i < booking.orders.length; i++) {
        total_credits += booking.orders[i].price * booking.orders[i].quantity;
        total_quantity += booking.orders[i].quantity;
      }
      if (booking.delivery_type == "ONLINE") {
        total_credits += total_quantity * general.delivery_charge;
      }
      // return res.json({
      //   total_credits,
      //   total_quantity
      // })
      if (prices.length == 0) {
        return res.json({
          status: false,
          message: "Prices required",
        });
      }
      if (products.length != quantities.length) {
        return res.json({
          status: false,
          message: "Products and quantities required",
        });
      }
      if (booking.scheduled_date == moment(new Date()).format("YYYY-MM-DD")) {
        if ((shift_details[0].start - new Date()) / 3600000 <= 6) {
          return res.json({
            status: false,
            message: "Scheduled order can only edit befor 6 hours",
          });
        }
      }

      // ////////////////////////check max limit for scheduled orders//////////////////
      let booked_orders = booking.orders;
      for (var i = 0; i < booked_orders.length; i++) {
        for (var j = 0; j < products.length; j++) {
          if (
            products[j].toString() == booked_orders[i].product_id.toString()
          ) {
            if (quantities[j] > booked_orders[i].quantity) {
              var address_details;
              if (delivery_type == "COLLECTIONPOINT") {
                address_details = await Address.findOne({
                  collectionpoint_id,
                });
              } else {
                address_details = await Address.findOne({
                  _id: address_id,
                });
              }
              let stock_limit = await ScheduleStockLimit.findOne({
                shift_id: booking.shift_id,
                product_id: products[j],
                suburb_id: address_details.suburb_id,
                delete_status: false,
              });
              let current_orders = await Booking.aggregate([
                {
                  $match: {
                    scheduled_date: new Date(
                      moment(booking.scheduled_date).format("YYYY-MM-DD")
                    ),
                    shift_id: ObjectId(booking.shift_id),
                  },
                },
                {
                  $lookup: {
                    from: "addresses",
                    let: {
                      collectionpoint_id: "$collectionpoint_id",
                      delivery_type: "$delivery_type",
                      address_id: "$address_id",
                    },
                    pipeline: [
                      {
                        $match: {
                          $expr: {
                            $cond: {
                              if: {
                                $eq: ["$$delivery_type", "ONLINE"],
                              },
                              then: {
                                $eq: ["$_id", "$$address_id"],
                              },
                              else: {
                                $eq: [
                                  "$collectionpoint_id",
                                  "$$collectionpoint_id",
                                ],
                              },
                            },
                            // $eq: ["$collectionpoint_id", "$$collectionpoint_id"]
                          },
                        },
                      },
                      {
                        $project: {
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
                  $match: {
                    "address.suburb_id": ObjectId(address_details.suburb_id),
                  },
                },
                {
                  $project: {
                    products: {
                      $filter: {
                        input: "$orders",
                        as: "order",
                        cond: {
                          $eq: ["$$order.product_id", ObjectId(products[j])],
                        },
                      },
                    },
                  },
                },
                {
                  $project: {
                    products: {
                      $arrayElemAt: ["$products", 0],
                    },
                  },
                },
                {
                  $project: {
                    product_id: "$products.product_id",
                    quantity: "$products.quantity",
                  },
                },
                {
                  $group: {
                    _id: null,
                    total_quantity: {
                      $sum: "$quantity",
                    },
                  },
                },
              ]);
              let product_details = await Product.findOne({
                _id: products[j],
              });
              if (
                current_orders.length > 0 &&
                current_orders[0].total_quantity == 0
              ) {
                if (stock_limit) {
                  let limit = stock_limit.limit;
                  if (quantities[j] > limit) {
                    return res.json({
                      status: false,
                      message: `Maximum count for schedule ${product_details.name} reached for the date`,
                    });
                  }
                }
              } else if (
                current_orders.length > 0 &&
                current_orders[0].total_quantity > 0
              ) {
                if (stock_limit) {
                  let rem =
                    parseInt(stock_limit.limit) -
                    parseInt(current_orders[0].total_quantity);
                  if (quantities[j] > rem) {
                    return res.json({
                      status: false,
                      message: `Maximum count for schedule ${product_details.name} reached for the date`,
                    });
                  }
                }
              } else if (current_orders.length == 0) {
                if (stock_limit) {
                  let limit = stock_limit.limit;
                  if (quantities[j] > limit) {
                    return res.json({
                      status: false,
                      message: `Maximum count for schedule ${product_details.name} reached for the date`,
                    });
                  }
                }
              }
            }
          }
        }
      }
      let orders_array = [];
      for (var i = 0; i < products.length; i++) {
        let order = {
          product_id: products[i],
          quantity: quantities[i],
          price: prices[i],
        };
        orders_array.push(order);
      }
      booking.delivery_type = delivery_type;
      if (delivery_type == "ONLINE") {
        booking.address_id = address_id;
      } else {
        booking.collectionpoint_id = collectionpoint_id;
      }
      booking.shift_id = shift_id;
      booking.orders = orders_array;
      await booking.save();
      let user = await User.findOne({
        _id: req.payload._id,
      });
      let payment_details = await Payment.findOne({
        _id: booking.payment_id,
      });
      if (payment_details.discount_price >= 0) {
        if (credit_used < 0) {
          let dis_price =
            parseFloat(payment_details.discount_price) +
            parseFloat(credit_used);
          if (dis_price >= 0) {
            payment_details.discount_price = dis_price;
            await payment_details.save();
          } else {
            let rem_amount = Math.abs(dis_price);
            user.credits.food =
              parseFloat(user.credits.food) + parseFloat(rem_amount);
            await user.save();
            payment_details.discount_price = 0;
          }
        } else {
          user.credits.food =
            parseFloat(user.credits.food) - parseFloat(credit_used);
          await user.save();
        }
      }
      console.log(transaction_id)
      if (transaction_id) {
        let payment = new Payment({
          user_id: req.payload._id,
          transaction_id,
          date: new Date(moment().format("YYYY-MM-DD")),
          actual_price: amount,
          total_price: amount,
          is_credit: true,
        });
        await payment.save();
        console.log("eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee")
        let transaction = new Transaction({
          user_id: req.payload._id,
          payment_id: transaction_id,
          amount: amount,
          gateway: type,
          type: "ORDER",
          booking_id: booking.booking_id,
          date: new Date(moment().format("YYYY-MM-DD HH:mm:ss")),
        })
        await transaction.save();
      }
      // await neworder_confirmed({
      //   name: user.name,
      //   to_email: user.email,
      //   order_id: booking._id,
      // });
      return res.json({
        status: true,
        message: "order has been updated",
      });
    } else {
      return res.json({
        status: false,
        message: "Booking cannot edit",
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

exports.bulkOrders = async (req, res) => {
  try {
    let bulk_orders = await TmpBooking.aggregate([
      {
        $match: {
          booking_type: "BULK",
          delete_status: false,
          user_id: ObjectId(req.payload._id),
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
                address_line1: 1,
                contact_person: 1,
                contact_number: 1,
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
          scheduled_date: 1,
          scheduled_time: 1,
          orders: 1,
          approximate_price: 1,
          price: 1,
          status: "$bulkorder_status",
          review: "$bulkorder_review",
          delivery_address: 1,
        },
      },
      {
        $sort: {
          scheduled_date: -1,
        },
      },
    ]);
    return res.json({
      status: true,
      data: bulk_orders,
    });
  } catch (err) {
    console.log(err);
    return res.json({
      status: false,
      message: "Sorry something went wrong",
    });
  }
};

exports.createPayment = async (req, res) => {
  let { nonce, amount, type } = req.body;
  if (!type) {
    type = "square";
  }

  amount = parseFloat(amount);
  amount = parseInt(parseFloat(amount.toFixed(2) * 100));
  try {
    if (type == "square") {
      let rng_key = "RNG-" + Math.floor(Date.now() / 1000);
      var apiInstance = new SquareConnect.PaymentsApi();
      var body = {
        source_id: nonce,
        idempotency_key: rng_key,
        amount_money: {
          amount,
          currency: "AUD",
        },
      };

      let response = {};
      await apiInstance.createPayment(body).then(
        function (data) {
          let { payment } = data;
          response = payment;
        },
        function (error) {
          console.log(error);
          throw new Error("Payment failed");
        }
      );

      return res.json({
        status: true,
        message: "Payment success",
        data: response,
      });
    } else {

      let gateway = "";
      if (config.PAYPAL_ENV == "DEMO") {
        gateway = new BrainTree.BraintreeGateway({
          environment: BrainTree.Environment.Sandbox,
          merchantId: config.BT_MerchantId,
          publicKey: config.BT_PublicKey,
          privateKey: config.BT_PrivateKey
        });
      } else {
         gateway = new BrainTree.BraintreeGateway({
          environment: BrainTree.Environment.Live,
          merchantId: config.BT_MerchantId,
          publicKey: config.BT_PublicKey,
          privateKey: config.BT_PrivateKey
        });

      }
      
      await gateway.transaction.sale({
          amount: +(amount/100),
          paymentMethodNonce: nonce,
          deviceData: {},
          options: {
            submitForSettlement: true
          }
        }, (err, result) => {
          if(err){
            return res.json({
              status: false,
              message: "Payment failed",
              err
            });
          }
          return res.json({
            status: true,
            message: "Payment success",
            data: result,
          });
      });
    }
  } catch (err) {
    console.log(err);
    return res.json({
      status: false,
      message: "Payment failed",
      err: err
    });
  }
};

exports.trackMyOrder = async (req, res) => {
  try {
    if (typeof req.query._id === "undefined") {
      return res.json({
        status: false,
        message: "order id is required",
      });
    }
    let { _id } = req.query;
    let booking = await Booking.findOne({
      _id,
    }).populate({
      path: "driver_id",
      select: "name email mobile image location",
    });
    if (booking.delivery_type != "ONLINE") {
      return res.json({
        status: false,
        message: "Tracking not available",
      });
    }
    if (booking.driver_id) {
      return res.json({
        status: true,
        data: booking.driver_id,
      });
    } else {
      return res.json({
        status: true,
        message: "Driver will arrive soon..",
      });
    }
    // let order = await Booking.aggregate([
    //   {
    //     $match: {
    //       _id: ObjectId(_id),
    //       user_id: ObjectId(req.payload._id)
    //     }
    //   },
    //   {
    //     $lookup: {
    //       from: 'addresses',
    //       let: {
    //         address_id: "$address_id"
    //       },
    //       pipeline: [
    //         {
    //           $match: {
    //             $expr: {
    //               $eq: ["$_id", "$$address_id"]
    //             }
    //           }
    //         }
    //       ],
    //       as: "delivery_address"
    //     }
    //   },
    //   {
    //     $addFields: {
    //       delivery_address: {
    //         $arrayElemAt: ["$delivery_address", 0]
    //       }
    //     }
    //   },
    //   {
    //     $project: {
    //       suburb_id: "$delivery_address.suburb_id",
    //       shift_id: "$shift_id",
    //       delivery_address: "$delivery_address"
    //     }
    //   },
    //   {
    //     $lookup: {
    //       from: 'stocks',
    //       let: {
    //         suburb_id: "$suburb_id",
    //         shift_id: "$shift_id"
    //       },
    //       pipeline: [
    //         {
    //           $match: {
    //             date: new Date(moment().format('YYYY-MM-DD')),
    //             type: 'DELIVERY',
    //             delete_status: false,
    //             $expr: {
    //               $and: [
    //                 {
    //                   $eq: ["$suburb_id", "$$suburb_id"]
    //                 },
    //                 {
    //                   $eq: ["$shift_id", "$$shift_id"]
    //                 }
    //               ]
    //             }
    //           }
    //         },
    //         {
    //           $project: {
    //             driver_id: 1,
    //             vehicle_id: 1,
    //           }
    //         },
    //         {
    //           $lookup: {
    //             from: "driver_logs",
    //             let: {
    //               driver_id: "$driver_id",
    //               shift_id: "$$shift_id"
    //             },
    //             pipeline: [
    //               {
    //                 $match: {
    //                   date: new Date(moment().format('YYYY-MM-DD')),
    //                   $expr: {
    //                     $and: [
    //                       { $eq: ["$driver_id", "$$driver_id"] },
    //                       { $eq: ["$shift_id", "$$shift_id"] }
    //                     ]
    //                   }
    //                 }
    //               }
    //             ],
    //             as: "driver_log"
    //           }
    //         },
    //         {
    //           $addFields: {
    //             driver_log: {
    //               $arrayElemAt: ["$driver_log", 0]
    //             }
    //           }
    //         },
    //         {
    //           $lookup: {
    //             from: "drivers",
    //             let: {
    //               driver_id: "$driver_id"
    //             },
    //             pipeline: [
    //               {
    //                 $match: {
    //                   $expr: {
    //                     $eq: ["$_id", "$$driver_id"]
    //                   }
    //                 }
    //               },
    //               {
    //                 $project: {
    //                   _id: 1,
    //                   name: 1,
    //                   email: 1,
    //                   image: 1,
    //                   mobile: 1,
    //                   location: 1,
    //                 }
    //               }
    //             ],
    //             as: "driver_details"
    //           }
    //         },
    //         {
    //           $addFields: {
    //             driver_details: {
    //               $arrayElemAt: ["$driver_details", 0]
    //             }
    //           }
    //         }
    //       ],
    //       as: "stocks"
    //     }
    //   },
    // ])
    // if (order[0].stocks[0].driver_details) {
    //   return res.json({
    //     status: true,
    //     data: order[0].stocks[0].driver_details
    //   })
    // } else {
    //   return res.json({
    //     status: true,
    //     message: "Driver will arrive soon"
    //   })
    // }
  } catch (err) {
    console.log(err);
    return res.json({
      status: false,
      message: "Sorry something went wrong",
    });
  }
};

exports.rateBooking = async (req, res) => {
  try {
    let { errors, isValid } = ValidateUserRateBooking(req.body);
    if (!isValid) {
      return res.json({
        status: false,
        message: errors[0],
      });
    }
    let { booking_id, service_rating } = req.body;
    let rating_exist = await Rating.countDocuments({
      booking_id,
      user_id: req.payload._id,
    });
    if (rating_exist > 0) {
      return res.json({
        status: false,
        message: "Already rated",
      });
    }
    let booking = await Booking.findOne({
      _id: booking_id,
      user_id: req.payload._id,
    });
    if (booking.redeemed == false) {
      return res.json({
        status: false,
        message: "Rating only after redeemed booking",
      });
    }
    let rating = new Rating({
      user_id: req.payload._id,
      booking_id,
      rating: service_rating,
    });
    await rating.save();
    return res.json({
      status: true,
      message: "Order rated successfully",
    });
  } catch (err) {
    console.log(err);
    return res.json({
      status: false,
      message: "Sorry something went wrong",
    });
  }
};

// exports.rateBooking = async (req, res) => {
//   try {
//     let { errors, isValid } = ValidateUserRateBooking(req.body)
//     if (!isValid) {
//       return res.json({
//         status: false,
//         message: errors[0]
//       })
//     }
//     let { booking_id, service_rating, food_rating } = req.body
//     let booking = await Booking.findOne({
//       _id: booking_id
//     })
//     if (booking.redeemed == false) {
//       return res.json({
//         status: false,
//         message: 'Rating only after redeemed booking'
//       })
//     }
//     booking.service_rating = parseFloat(service_rating)
//     booking.food_rating = parseFloat(food_rating)
//     await booking.save()
//     let ratings = await Booking.aggregate([
//       {
//         $match: {
//           delivered_by: ObjectId(booking.delivered_by)
//         }
//       },
//       {
//         $group: {
//           _id: null,
//           avg_rating: {
//             $avg: '$service_rating'
//           }
//         }
//       }
//     ])
//     // await Driver.updateOne({
//     //   _id: booking.delivered_by
//     // }, {
//     //   rating: ratings[0].avg_rating,
//     //   total_ratings: total_ratings + 1
//     // })
//     let driver = await Driver.findOne({
//       _id: booking.delivered_by
//     })
//     if (driver.total_ratings) {
//       total_ratings = driver.total_ratings + 1
//     } else {
//       total_ratings = 1
//     }
//     driver.rating = ratings[0].avg_rating
//     driver.total_ratings = total_ratings
//     await driver.save()
//     let product_ids = []
//     for (var i = 0; i < booking.orders.length; i++) {
//       product_ids.push(booking.orders[i].product_id)
//     }
//     console.log(product_ids)
//     await Product.updateMany({
//       _id: {
//         $in: product_ids
//       }
//     }, {
//       $inc: {
//         rating: food_rating,
//         total_ratings: 1
//       }
//     })
//     // ///////////////////////////rating for food - Pending////////////////////////////////////
//     return res.json({
//       status: true,
//       message: "Rating added successfully"
//     })
//   } catch (err) {
//     console.log(err)
//     return res.json({
//       status: false,
//       message: 'Sorry something went wrong'
//     })
//   }
// }

exports.allocate = async (req, res) => {
  try {
    const { allocateSlot } = require("../../controllers/api/productController");
    let { booking_id } = req.body;
    let booking = await Booking.findOne({
      _id: booking_id,
    });
    let allocate_details = await allocateSlot({
      shift_id: booking.shift_id,
      driver_id: booking.driver_id,
      booking_id: booking._id,
      address_id: booking.address_id,
    });
    return res.json({
      allocate_details,
    });
  } catch (err) {
    console.log(err);
  }
};

exports.hasRealTimeDelivery = async (req, res) => {
  try {
    let user_address = await Address.findOne({
      user_id: req.payload._id,
      delete_status: false,
      active_location: true,
    });
    let suburb = await Suburb.findOne({
      _id: user_address.suburb_id,
    });

    if (suburb && suburb.has_realtime_order == true) {
      return res.json({
        status: true,
        message: "Continue...",
      });
    } else {
      return res.json({
        status: false,
        message: "Delivery not available for your current address",
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

exports.getHasStockCollectionPoints = async (req, res) => {
  try {
    let { products, quantities } = req.body;
    if (products.length == 0 || products[0] == "") {
      return res.json({
        status: false,
        message: "Products required",
      });
    }
    if (quantities.length == 0 || quantities[0] == "") {
      return res.json({
        status: false,
        message: "Quantities required",
      });
    }
    if (products.length != quantities.length) {
      return res.json({
        status: false,
        message: "Sorry somethingg went wrong",
      });
    }

    let products_array = [];
    for (var i = 0; i < products.length; i++) {
      products_array.push({
        product_id: ObjectId(products[i]),
        count: parseInt(quantities[i]),
      });
    }
    let user_address = await Address.findOne({
      user_id: req.payload._id,
      active_location: true,
      delete_status: false,
    });
    console.log(products_array);
    let query = [
      {
        $lookup: {
          from: "addresses",
          let: {
            collectionpoint_id: "$_id",
          },
          pipeline: [
            {
              $geoNear: {
                near: {
                  type: "Point",
                  coordinates: [
                    user_address.location.coordinates[0],
                    user_address.location.coordinates[1],
                  ],
                },
                key: "location",
                spherical: true,
                distanceField: "distance",
                distanceMultiplier: 0.001,
              },
            },
            {
              $match: {
                // suburb_id: ObjectId(user_address.suburb_id),
                $expr: {
                  $eq: ["$collectionpoint_id", "$$collectionpoint_id"],
                },
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
        $match: {
          delete_status: false,
          approved: true,
          rejected: false,
        },
      },
      {
        $lookup: {
          from: "cp_stocks",
          let: {
            collectionpoint_id: "$_id",
          },
          pipeline: [
            {
              $match: {
                delete_status: false,
                $expr: {
                  $and: [
                    {
                      $gte: [
                        "$date",
                        new Date(moment().format("YYYY-MM-DD 00:00:000")),
                      ],
                    },
                    {
                      $lte: [
                        "$date",
                        new Date(moment().format("YYYY-MM-DD 23:59:000")),
                      ],
                    },
                    {
                      $eq: ["$collectionpoint_id", "$$collectionpoint_id"],
                    },
                  ],
                },
              },
            },
            {
              $unwind: "$products",
            },
            {
              $addFields: {
                required_product: {
                  $filter: {
                    input: products_array,
                    as: "product",
                    cond: {
                      $and: [
                        {
                          $eq: ["$$product.product_id", "$products.product_id"],
                        },
                        { $gte: ["$products.stock", "$$product.count"] },
                      ],
                    },
                  },
                },
              },
            },
            {
              $addFields: {
                required_product: {
                  $arrayElemAt: ["$required_product", 0],
                },
              },
            },
            {
              $group: {
                _id: "$_id",
                products: {
                  $push: "$products",
                },
                required_product: {
                  $push: "$required_product",
                },
              },
            },
            {
              $addFields: {
                products_array: products_array,
              },
            },
            {
              $addFields: {
                product_array_length: {
                  $size: "$products_array",
                },
                required_product_length: {
                  $size: "$required_product",
                },
              },
            },
            {
              $match: {
                $expr: {
                  $eq: ["$product_array_length", "$required_product_length"],
                },
              },
            },
          ],
          as: "stocks",
        },
      },
      {
        $unwind: "$stocks",
      },
      {
        $project: {
          _id: "$_id",
          name: "$name",
          contact_name: "$contact_name",
          email: "$email",
          mobile: "$mobile",
          // products: "$stocks.products",
          location: "$address.location",
          address_line1: "$address.address_line1",
          address_line2: "$address.address_line2",
          distance: "$address.distance",
          starttime: "$starttime",
          closetime: "$closetime",
        },
      },
    ];
    let collection_points = await CollectionPoint.aggregate(query);
    console.log(collection_points);
    if (collection_points.length > 0) {
      return res.json({
        status: true,
        data: collection_points,
      });
    } else {
      return res.json({
        status: false,
        message: "No collection point has not enough stock to supply",
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

exports.hasRealTimeOnlineDelivery = async (req, res) => {
  try {
    let user_address = await Address.findOne({
      user_id: req.payload._id,
      delete_status: false,
      active_location: true,
    });
    let { shifts, coming_shift } = await this.getComingShift();
    let suburb = await Suburb.findOne({
      _id: user_address.suburb_id,
    });
    if (suburb.has_online_delivery.includes(coming_shift)) {
      return res.json({
        status: true,
        message: "Location has delivery",
      });
    } else {
      return res.json({
        status: false,
        message: "Realtime delivery not available for your current address",
      });
    }
    // if(suburb && suburb.has_online_delivery == true) {
    //   return res.json({
    //     status: true,
    //     message: 'Location has delivery'
    //   })
    // } else {
    //   return res.json({
    //     status: false,
    //     message: "Real time delivery not available for your current address"
    //   })
    // }
  } catch (err) {
    console.log(err);
    return res.json({
      status: false,
      message: "Sorry somwthing went wrong",
    });
  }
};
