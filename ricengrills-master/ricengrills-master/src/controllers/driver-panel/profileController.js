const mongoose = require("mongoose");
const Driver = mongoose.model("drivers")
const paginate = require("express-paginate");


const collectionPointupload = require("../../utils/uploads/collectionpointUpload");
const {
  validatePasswordUpdateInputs,
  validateUpdateProfileInputs,
  ValidateForgotPasswordInput,
  ValidateForgotUpdatePassword,
} = require("../../validators/admin/profileValidator");

exports.checkEmailExists = async (email, id) => {
  return await Driver.countDocuments({
    email,
    delete_status: false,
    _id: {
      $ne: id,
    },
  });
};

exports.checkMobileExists = async (mobile, id) => {
  return await Driver.countDocuments({
    mobile,
    delete_status: false,
    _id: {
      $ne: id,
    },
  });
};

exports.edit = async (req, res) => {
  admin = await Driver.findOne({_id:req.session._id})
  let data = {admin}
  return res.render("driver-panel/profile", data)
};

exports.updateProfile = async (req, res) => {
  try {
    await collectionPointupload(req, res);
  } catch (err) {
    console.log(err);
    return res.json({
      status: false,
      message: "Could not upload image",
    });
  }

  const { errors, isValid } = validateUpdateProfileInputs(req.body);

  if (!isValid) {
    return res.json({
      status: false,
      errors,
    });
  }

  let emailExists = await this.checkEmailExists(
    req.body.email,
    req.session._id
  );
  if (emailExists) {
    return res.json({
      status: false,
      message: "Email already exists",
    });
  }

  if (req.body.mobile != "") {
    let mobileExists = await this.checkMobileExists(
      req.body.mobile,
      req.session._id
    );
    if (mobileExists) {
      return res.json({
        status: false,
        message: "Mobile already Exists",
      });
    }
  }

  let admin = await Driver.findOne({ _id: req.session._id });
  let image = null;
  if (req.files.image) {
    image = "/" + req.files.image[0].path || null;
  } else {
    image = admin.image;
  }
  admin.name = req.body.name;
  admin.email = req.body.email;
  admin.image = image;
  admin.mobile = req.body.mobile;
  try {
    await admin.save();
    req.session.name = req.body.name;
    req.session.image = image;
    return res.json({
      status: true,
      image,
      message: "Profile details updated successfully",
    });
  } catch (err) {
    console.log(err);
    return res.json({ status: false, message: "failes" });
  }
};

exports.updatePassword = async (req, res) => {
  const { errors, isValid } = validatePasswordUpdateInputs(req.body);

  if (!isValid) {
    return res.json({
      status: false,
      errors,
    });
  }

  if (req.body.password == req.body.cpassword) {
    let admin = await Driver.findOne({
      _id: req.session._id,
    });
    admin.setPassword(req.body.password);
    await admin.save();
    return res.json({
      status: true,
      message: "Password has been updated successfully",
    });
  } else {
    return res.json({
      status: false,
      message: "Password and confirm password should be same",
    });
  }
};

exports.generateToken = () => {
  return (
    Math.random().toString(36).substr(2) +
    Math.random().toString(36).substr(2) +
    Date.now()
  );
};

exports.forgotPassword = async (req, res) => {
  const {
    sendMagicLink,
  } = require("../../utils/emails/driver-panel/forgotpassword");
  const { errors, isValid } = ValidateForgotPasswordInput(req.body);
  if (!isValid) {
    return res.json({
      status: false,
      errors,
    });
  }
  try {
    let { email } = req.body;
    let admin = await Driver.findOne({
      email,
      delete_status:false
    });
    if (admin) {
      let token = this.generateToken();
      admin.token = token;
      admin.token_expiry = new Date().setHours(new Date().getHours() + 1);
      await admin.save();
      let reset_link = res.locals.app_url + "/password-reset/" + token;
      await sendMagicLink({
        name: admin.name,
        reset_link,
        email,
      });
      return res.json({
        status: true,
        message: "We have e-mailed your password reset link",
        reset_link,
      });
    } else {
      return res.json({
        status: false,
        message: "Email id is not registered with us",
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

exports.resetPassword = async (req, res) => {
  try {
    let { token } = req.params;
    let admin = await Driver.findOne({
      token,
    });
    if (admin) {
      return res.render("cp/reset-password", admin);
    } else {
      return res.send("The link has been expired");
    }
  } catch (err) {
    console.log(err);
    return res.json({
      status: false,
      message: "Sorry something went wrong",
    });
  }
};

exports.updateNewPassword = async (req, res) => {
  const { errors, isValid } = ValidateForgotUpdatePassword(req.body);
  if (!isValid) {
    return res.json({
      status: false,
      errors,
    });
  }
  try {
    let { token, password, cpassword } = req.body;
    let admin = await Driver.findOne({
      token,
      delete_status:false
    });
    if (admin) {
      if (password == cpassword) {
        await admin.setPassword(password);
        await admin.save();
        return res.json({
          status: true,
          message: "Your password has been updated successfully",
        });
      } else {
        return res.json({
          status: false,
          message: "Password and confirm password are not matching",
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

// exports.resetPassword = async (req, res) => {
//   const {
//     cpadminPasswordUpdatedMail,
//   } = require("../../utils/emails/collectionpoints/password_updated");
//   try {
//     let { id } = req.body;
//     let password = Math.random().toString(36).substr(2);
//     let admin = await CP.findOne({
//       _id: id,
//     });
//     admin.setPassword(password);
//     await admin.save();
//     await cpadminPasswordUpdatedMail({
//       name: admin.name,
//       email: admin.email,
//       password,
//     });
//     return res.json({
//       status: true,
//       message: "New password has been e-mailed to users mail address",
//     });
//   } catch (err) {
//     console.log(err);
//     return res.json({
//       status: false,
//       message: "Sorry something went wrong",
//     });
//   }
// };
