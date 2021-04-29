const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;
const paginate = require("express-paginate");
const User = mongoose.model("users");
const Address = mongoose.model("addresses")
const UserLocation = mongoose.model("users_locations");
const passport = require("passport");
const fs = require("fs");
const Transaction = mongoose.model("transactions")
const config = require("config")

const SquareConnect = require("square-connect");
let defaultClient = SquareConnect.ApiClient.instance;
if (config.SQUARE_ENV == "DEMO") {
  defaultClient.basePath = "https://connect.squareupsandbox.com";
} else {
  defaultClient.basePath = "https://connect.squareup.com";
}
let oauth2 = defaultClient.authentications["oauth2"];
oauth2.accessToken = config.SQUARE_TOKEN;

//paypal
const PayPal = require("@paypal/checkout-server-sdk");

const { snedSignUpOtp } = require("../../utils/emails/user/signup_otp");
const {
  ValidateUserSignUpInputs,
  ValidateUserSignupResendOtpInputs,
  ValidateUserSignUpVerifyOtpInputs,
  ValidateUserSignInVerifyOtpInputs,
} = require("../../validators/usersValidator");
const {
  ValidateUserAddLocation,
} = require("../../validators/usersLocationValidator");
const { pipeline } = require("stream");

exports.listUsers = async (req, res) => {
  let { search, limit, page } = req.query;
  if (typeof limit == 'undefined') {
    limit = 20
  }

  if (typeof page == 'undefined') {
    page = 1
  }

  let skip = 0
  if (page > 1) {
    skip = (page - 1) * limit
  }

  var query = [
    {
      $sort: {
        _id: -1
      }
    }
  ];
  if (search) {
    let regex = { $regex: new RegExp(".*" + search.trim() + ".*", "i") };
    query.push({
      $match: {
        $or: [
          { 'name': regex },
          { 'email': regex },
          { 'mobile': regex },
        ]
      }
    })
  }


  let itemCount = await User.aggregate([...query,
  {
    $count: "count"
  }
  ])

  let users = await User.aggregate([...query,
  {
    $skip: skip
  }, {
    $limit: limit
  },
  ])

  user_ids = []
  users.forEach(user => {
    user_ids.push(ObjectId(user._id))
  })

  users = await User.aggregate([
    {
      $match:{
        _id: {
          $in: user_ids
        }
      }
    },
    {
      $lookup: {
        from: "addresses",
        let: { user_id: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$delete_status", false] },
                  { $eq: ["$active_location", true] },
                  { $eq: ["$user_id", "$$user_id"] }
                ]
              }
            }
          },
          {
            $lookup: {
              from: "suburbs",
              let: { suburb_id: "$suburb_id" },
              pipeline: [
                {
                  $match: {
                    $expr: {
                      $and: [
                        { $eq: ["$_id", "$$suburb_id"] }
                      ]
                    }
                  }
                },
                {
                  $project: {
                    name: 1
                  }
                }
              ],
              as: "suburb"
            }
          },
          {
            $addFields: {
              suburb: {
                $arrayElemAt: ["$suburb", 0]
              }
            }
          },
        ],
        as: "address"
      }
    },
    {
      $addFields: {
        address: {
          $arrayElemAt: ["$address", 0]
        },
        suburb: {
          $arrayElemAt: ["$address.suburb", 0]
        }
      }
    },
    {
      $sort:{
        created_at : -1
      }
    }
  ])

  if (itemCount.length > 0) {
    itemCount = itemCount[0].count
  } else {
    itemCount = 0
  }

  const pageCount = Math.ceil(itemCount / limit);
  let data = {
    search,
    users,
    itemCount,
    pageCount,
    pages: paginate.getArrayPages(req)(5, pageCount, page),
    activePage: page,
  };
  console.log(data);
  return res.render("admin/user/listUsers", data);
};

exports.deactivate = async (req, res) => {
  try {
    let { id } = req.body;
    const user = await User.findOne({ _id: id });
    if (user) {
      user.active_status = !user.active_status;
      await user.save();
      if (user.active_status)
        return res.json({
          status: true,
          message: "User has been deactivated",
        });
      else
        return res.json({
          status: true,
          message: "User has been activated",
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

exports.transactions = async (req, res) => {
  let { search, limit, page } = req.query;
  if (typeof limit == 'undefined') {
    limit = 20
  }

  if (typeof page == 'undefined') {
    page = 1
  }

  let skip = 0
  if (page > 1) {
    skip = (page - 1) * limit
  }

  let query = [
    {
      $lookup: {
        from: "users",
        let: {
          user_id: "$user_id"
        },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$_id", "$$user_id"] }
                ]
              }
            }
          },
          {
            $project: {
              name: 1,
              email: 1,
              mobile: 1,
              credits: "$credits.food"
            }
          }
        ],
        as: "user"
      }
    },
    {
      $match: {
        $expr: {
          $gt: [{ $size: "$user" }, 0]
        }
      }
    },
    {
      $addFields: {
        user: {
          $arrayElemAt: ["$user", 0]
        }
      }
    },
    {
      $sort: {
        _id: -1
      }
    }
  ]


  if (search) {
    let regex = { $regex: new RegExp(".*" + search.trim() + ".*", "i") };
    query.push({
      $match: {
        $or: [
          { 'user.name': regex },
          { 'user.email': regex },
          { 'user.mobile': regex },
          { 'booking_id': regex },
        ]
      }
    })
  }


  let itemCount = await Transaction.aggregate([...query,
  {
    $count: "count"
  }
  ])

  let transactions = await Transaction.aggregate([...query,
  {
    $skip: skip
  }, {
    $limit: limit
  },
  ])

  if (itemCount.length > 0) {
    itemCount = itemCount[0].count
  } else {
    itemCount = 0
  }

  const pageCount = Math.ceil(itemCount / limit);
  let data = {
    search,
    transactions,
    itemCount,
    pageCount,
    pages: paginate.getArrayPages(req)(5, pageCount, page),
    activePage: page,
  };
  return res.render("admin/transactions/list", data)
}

exports.processTransaction = async (req, res) => {
  try {
    let { payment_id, amount: entered_amount } = req.body
    entered_amount = parseFloat(entered_amount)

    let transaction = await Transaction.findOne({ payment_id, refund_status: false })
    if (!transaction) {
      throw new Error("No transaction")
    }
    let { amount, refund_amount } = transaction
    if (+amount - +refund_amount <= 0) {
      throw new Error("Refund amount less than zero")
    }

    if (entered_amount <= (+amount - +refund_amount)) {

      let body = {
        "amount_money": {
          "amount": parseInt(parseFloat(+entered_amount.toFixed(2)) * 100),
          "currency": "AUD"
        },
        "idempotency_key": "RNG-" + Math.floor(Date.now() / 1000),
        "payment_id": payment_id,
      }

      let apiInstance = new SquareConnect.RefundsApi();
      let response = {};
      await apiInstance.refundPayment(body).then(
        function (data) {
          let { refund } = data;
          if (refund) {
            response = refund
          }
        },
        function (error) {
          console.error(error);
          throw new Error("Payment api call failed")
        }
      );

      if (response) {
        let { id: refund_id, amount_money } = response
        await apiInstance.getPaymentRefund(refund_id).then(async function () {
          transaction.refund_amount = transaction.refund_amount + (amount_money.amount / 100)
          if (transaction.refund_amount <= 0) {
            transaction.refund_amount = 0
            transaction.refund_status = true
          }
          await transaction.save()
        }, function (error) {
          console.error(error);
          throw new Error("Payment api call failed")
        })
      }

      return res.json({
        status: true,
        message: "Payment refund initiated"
      })

    } else {
      return res.json({
        status: false,
        message: "Entered amount greater than actual amount"
      })
    }
  } catch (err) {
    console.log(err)
    return res.json({
      status: false,
      message: "Transaction could not process"
    })
  }

}


exports.processTransactionPaypal = async (req, res) => {
  try {
    let { payment_id, amount: entered_amount } = req.body
    entered_amount = parseFloat(entered_amount)

    let transaction = await Transaction.findOne({ payment_id, refund_status: false })
    if (!transaction) {
      throw new Error("No transaction")
    }
    let { amount, refund_amount } = transaction
    if (+amount - +refund_amount <= 0) {
      throw new Error("Refund amount less than zero")
    }

    if (entered_amount <= (+amount - +refund_amount)) {

      let environment = "";
      if (config.PAYPAL_ENV == "DEMO") {
        environment = new PayPal.core.SandboxEnvironment(
          config.PAYPAL_CLIENT_ID,
          config.PAYPAL_CLIENT_SECRET
        );
      } else {
        environment = new PayPal.core.LiveEnvironment(
          config.PAYPAL_CLIENT_ID,
          config.PAYPAL_CLIENT_SECRET
        );
      }
      client = new PayPal.core.PayPalHttpClient(environment);

      const request = new PayPal.payments.CapturesRefundRequest(payment_id);
      request.requestBody({
        amount: {
          currency_code: 'AUD',
          value: +entered_amount
        }
      });
      let refund = await client.execute(request);
      let {status, id: refund_id, amount} = refund
      if(status == "COMPLETED"){
        transaction.refund_amount = transaction.refund_amount + amount.value
        if (transaction.refund_amount <= 0) {
          transaction.refund_amount = 0
          transaction.refund_status = true
        }
        await transaction.save()
      }else{
        throw new Error("Payment api call failed")
      }

      return res.json({
        status: true,
        message: "Payment refund initiated"
      })

    } else {
      return res.json({
        status: false,
        message: "Entered amount greater than actual amount"
      })
    }
  } catch (err) {
    console.log(err)
    return res.json({
      status: false,
      message: "Transaction could not process"
    })
  }

}

exports.updateUserCredit = async (req, res) => {
  try {
    let { user_id, credit_amount: entered_amount } = req.body
    entered_amount = parseFloat(entered_amount)

    let user = await User.findOne({ _id: ObjectId(user_id) })
    if (!user) {
      throw new Error("User not found")
    }
    if (entered_amount < 0) {
      return res.json({
        status: false,
        message: `Entered amount "${entered_amount}" should be greater than zero`
      })
    }

    user.credits.food = entered_amount
    await user.save()
    return res.json({
      status: true,
      message: "User credits added successfully"
    })

  } catch (err) {
    console.log(err)
    return res.json({
      status: false,
      message: "Could not edit user credits"
    })
  }
}