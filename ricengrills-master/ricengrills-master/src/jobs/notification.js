var Queue = require("bull");
const mongoose = require("mongoose");
let ObjectId = mongoose.Types.ObjectId;
const Notification = mongoose.model("notifications");
const DriverNotification = mongoose.model("driver_notifications");
const JobNotification = mongoose.model("job_notifications");
const User = mongoose.model("users");
const Admin = mongoose.model("admins");
const Suburb = mongoose.model("suburbs");
const Driver = mongoose.model("drivers");
const Order = mongoose.model("bookings");
const CollectionPoint = mongoose.model("collectionpoints")
const config = require("config");
const FCM = require("fcm-push");
const moment = require("moment");
let fcm = new FCM(config.FCM_SERVER_KEY);
var { sendNotification } = require("../utils/emails/admin/notifications");
var { neworder_confirmed } = require("../utils/emails/user/orders");

var adminNotificationQueue = new Queue(
  "admin notification",
  {redis: {port: 6379, host: '127.0.0.1'} }
);
var driverJobNotificationQueue = new Queue(
  "driver job notification",
  {redis: {port: 6379, host: '127.0.0.1'} }
);
var addCreditByReferal = new Queue(
  "add credit by referal",
  {redis: {port: 6379, host: '127.0.0.1'} }
);
var sendJobApproval = new Queue("send job approval", {redis: {port: 6379, host: '127.0.0.1'} });
var sendOrderConfirm = new Queue(
  "Order confirmation",
  {redis: {port: 6379, host: '127.0.0.1'} }
);

var sendDriverFoodRequest = new Queue("stock request", {redis: {port: 6379, host: '127.0.0.1'} });

var sendCpFoodRequest = new Queue("Stock request from Collection Point", {redis: {port: 6379, host: '127.0.0.1'} });

adminNotificationQueue.process(async function (job, done) {
  let { notification_id, email } = job.data;
  console.log(notification_id);
  console.log("________________________________________________________");
  let notification = await Notification.findOne({
    _id: ObjectId(notification_id),
  });
  if (!notification) {
    done();
  }

  let suburbs = notification.suburbs;

  let users = await User.aggregate([
    {
      $match: {
        active_status: true,
        // deActivate: false,
        // verified: true,
        delete_status: false,
        device_token: {
          $ne: null,
        },
      },
    },
    {
      $lookup: {
        from: "addresses",
        let: {
          user_id: "$_id",
        },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$user_id", "$$user_id"] },
                  { $eq: ["$delete_status", false] },
                  {
                    $in: ["$suburb_id", suburbs],
                  },
                ],
              },
            },
          },
          {
            $count: "count",
          },
        ],
        as: "addresses",
      },
    },
    {
      $addFields: {
        address_count: {
          $size: "$addresses",
        },
      },
    },
    {
      $match: {
        $expr: {
          $and: [{ $gte: ["$address_count", 1] }],
        },
      },
    },
    {
      $project: {
        fcm: 1,
        device_token: 1,
        address_count: 1,
        addresses: 1,
        email: 1,
        name: 1,
      },
    },
  ]);

  console.log(users);

  let fcms = [];
  let emails = [];
  if (users.length > 0) {
    users.forEach((user) => {
      // fcms.push(user.fcm)
      fcms.push(user.device_token);
      if (user.email) {
        emails.push({ name: user.name, email: user.email });
      }
    });
  }

  if (fcms.length > 0) {
    var i = 0;
    fcms.forEach((id) => {
      i++;
      let topic = "admin_notifications";
      let message = {
        to: id,
        priority: "high",
        notification: {
          title: notification.title,
          body: notification.description,
          image: notification.image,
        },
        data: {},
        topic,
      };

      //promise style
      fcm
        .send(message)
        .then(function (response) {
          console.log("Successfully sent with response: ", response);
        })
        .catch(function (err) {
          console.log("Something has gone wrong!");
          console.error(err);
        });
      job.progress(i);
    });
  }

  if (emails.length > 0 && email) {
    emails.forEach(async (user) => {
      let { name, email } = user;
      await sendNotification({
        name,
        email,
        title: notification.title,
        description: notification.description,
      });
    });
  }
  done();
});

driverJobNotificationQueue.process(async function (job, done) {
  let { job_id } = job.data;
  let notifications = await JobNotification.aggregate([
    {
      $match: {
        delete_status: false,
        _id: ObjectId(job_id),
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
        accepted_drivers: {
          $size: "$accepted_drivers",
        },
        rejected_drivers: {
          $size: "$rejected_drivers",
        },
      },
    },
    {
      $project: {
        _id: 1,
        shift: 1,
        accepted_drivers: 1,
        rejected_drivers: 1,
      },
    },
  ]);

  let notification = null;
  if (notifications.length > 0) {
    notification = notifications[0];
  }

  if (!notification) {
    done();
  }

  let {
    date,
    shift: { name: shift_name },
  } = notification;

  let db_notification = new DriverNotification({
    title: "New job is scheduled",
    description: `New job is scheduled for ${shift_name} on ${moment(
      date
    ).format("YYYY-MM-DD")} please submit your interest`,
    type: "JOB_SCHEDULE",
  });
  await db_notification.save();

  let users = await Driver.aggregate([
    {
      $match: {
        is_approved: true,
        delete_status: false,
        device_token: {
          $ne: null,
        },
      },
    },
    {
      $project: {
        device_token: 1,
      },
    },
  ]);

  console.log(users);

  let fcms = [];
  if (users.length > 0) {
    users.forEach((user) => {
      fcms.push(user.device_token);
    });
  }

  if (fcms.length > 0) {
    var i = 0;
    fcms.forEach((id) => {
      i++;
      let topic = "job_notification";
      let message = {
        to: id,
        priority: "high",
        notification: {
          title: `New job is scheduled`,
          body: `New job is scheduled for ${shift_name} on ${moment(
            date
          ).format("YYYY-MM-DD")} please submit your interest`,
          sound: "default",
          badge: 1,
        },
        data: {
          type: "job_schedule",
        },
        topic,
      };

      //promise style
      fcm
        .send(message)
        .then(function (response) {
          console.log("Successfully sent with response: ", response);
        })
        .catch(function (err) {
          console.log("Something has gone wrong!");
          console.error(err);
        });
      job.progress(i);
    });
  }
  done();
});

addCreditByReferal.process(async function (job, done) {
  let { from_user, to_user } = job.data;
  let referer = await User.findOne({ _id: ObjectId(to_user) });
  let referee = await User.findOne({ _id: ObjectId(from_user) });
  job.progress(1);
  let topic = "credit_from_referal";

  let message = {
    to: referer.device_token,
    priority: "high",
    notification: {
      title: `Credit has been added`,
      body: `Credit added from your reffered user ${referee.name} on his first purchase`,
      sound: "default",
      badge: 1,
    },
    data: {
      type: "credit_from_referal",
    },
    topic,
  };
  console.log(message);

  fcm
    .send(message)
    .then(function (response) {
      console.log("Successfully sent with response: ", response);
    })
    .catch(function (err) {
      console.log("Something has gone wrong!");
      console.error(err);
    });

  done();
});

sendJobApproval.process(async function (job, done) {
  let { notification_id } = job.data;
  let notifications = await JobNotification.aggregate([
    {
      $match: {
        _id: ObjectId(notification_id),
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
      $lookup: {
        from: "drivers",
        let: {
          approved_drivers: "$approved_drivers",
        },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [{ $in: ["$_id", "$$approved_drivers"] }],
              },
            },
          },
          {
            $project: {
              _id: 1,
              name: 1,
              email: 1,
              mobile: 1,
              device_token: 1,
            },
          },
        ],
        as: "approved_drivers",
      },
    },
    {
      $project: {
        _id: 1,
        shift: 1,
        approved_drivers: 1,
        date: 1,
        created_at: 1,
      },
    },
  ]);

  if (notifications.length > 0) {
    let notification = notifications.shift();
    let {
      shift: { name: shift_name },
      approved_drivers,
      date,
    } = notification;
    if (approved_drivers.length > 0) {
      approved_drivers.forEach((driver, i) => {
        let { device_token } = driver;

        let topic = "job_approval_notification";
        let message = {
          to: device_token,
          priority: "high",
          notification: {
            title: `Job schedule confirmed`,
            body: `Job schedule confirmed for shift - ${shift_name} on ${moment(
              date
            ).format("YYYY-MM-DD")}`,
          },
          data: {
            type: "job_approval_notification",
          },
          topic,
        };
        fcm
          .send(message)
          .then(function (response) {
            console.log("Successfully sent with response: ", response);
          })
          .catch(function (err) {
            console.log("Something has gone wrong!");
            console.error(err);
          });
        job.progress(i);
      });
    }
    done();
  }
});

invoicehtml = (booking) => {
  let { booking_id, orders, scheduled_date, created_at, shift_details, address_details, user_details, payment_details, delivery_type } = booking
  let shift_name = ""
  let address_html = ""
  //user details
  let name = ""
  let mobile = ""
  let email = ""
  delivery_type = delivery_type == "ONLINE" ? "DELIVERY" : "PICKUP"
  if (shift_details) { //shift details
    shift_name = shift_details.name
  }
  if (address_details) {
    let { type } = address_details
    if (type == "USER") {
      let { address_line1, address_line2, house_flat_no, appartment, landmark, to_reach } = address_details
      if (address_line1) {
        address_html += address_line1 + '<br/>'
      }
      if (address_line2) {
        address_html += address_line2 + '<br/>'
      }
      if (house_flat_no) {
        address_html += house_flat_no + ','
      }
      if (appartment) {
        address_html += appartment + ','
      }
      if (landmark) {
        address_html += landmark + '<br/>'
      }
      if (to_reach) {
        address_html += to_reach
      }
    }
  }
  if (user_details) {
    let { name: user_name, mobile: user_mobile, email: user_email } = user_details
    name = user_name
    mobile = user_mobile
    email = user_email
  }

  let rng_credits_html = ""
  let square_payment_html = ""
  let coupon_html = ""

  let total_price = 0
  let delivery_charge = 0
  let service_charge = 0

  if (payment_details) {
    let { credit_used, transaction_id, coupon, total_price:tot_price,service_charge:service_chrg,delivery_charge:delivery_chrg } = payment_details
    total_price = tot_price
    delivery_charge = delivery_chrg
    service_charge = service_chrg

    if (credit_used) {
      rng_credits_html += `
        <tr class="details">
          <td>
              RNG Credits
          </td>                  
          <td>
              $${credit_used.toFixed(2)}
          </td>
        </tr>
      `
    }
    if (transaction_id) {
      if (transaction_details) {
        let { payment_id, amount } = transaction_details
        square_payment_html = `
          <tr class="details">
            <td>
                Payment (Square- ${payment_id})
            </td>                  
            <td>
                $${amount.toFixed(2)}
            </td>
          </tr>
        `
      }
    }

    if (coupon) {
      let { discount_price } = payment_details
      coupon_html = `
          <tr class="details">
            <td>
                Coupon (${coupon})
            </td>                  
            <td>
                $${discount_price.toFixed(2)}
            </td>
          </tr>
        `
    }

  }

  let orders_html = ""
  if(orders.length > 0){
    orders.forEach((order)=>{
      let {product_name, price, quantity } = order
      let tot_price = 0
      if(price){
        tot_price = price * quantity 
      }
      orders_html += `
        <tr class="item">
            <td>
                ${product_name}
            </td>            
            <td>
                $${tot_price.toFixed(2)}
            </td>
        </tr>
      `
    })
  }

  return `
  <!doctype html>
  <html>
  <head>
      <meta charset="utf-8">
      <title>A simple, clean, and responsive HTML invoice template</title>    
      <style>
      .invoice-box {
          max-width: 800px;
          margin: auto;
          padding: 30px;
          border: 1px solid #eee;
          box-shadow: 0 0 10px rgba(0, 0, 0, .15);
          font-size: 16px;
          line-height: 24px;
          font-family: 'Helvetica Neue', 'Helvetica', Helvetica, Arial, sans-serif;
          color: #555;
      }
      
      .invoice-box table {
          width: 100%;
          line-height: inherit;
          text-align: left;
      }
      
      .invoice-box table td {
          padding: 5px;
          vertical-align: top;
      }
      
      .invoice-box table tr td:nth-child(2) {
          text-align: right;
      }
      
      .invoice-box table tr.top table td {
          padding-bottom: 20px;
      }
      
      .invoice-box table tr.top table td.title {
          font-size: 45px;
          line-height: 45px;
          color: #333;
      }
      
      .invoice-box table tr.information table td {
          padding-bottom: 40px;
      }
      
      .invoice-box table tr.heading td {
          background: #eee;
          border-bottom: 1px solid #ddd;
          font-weight: bold;
      }
      
      .invoice-box table tr.details td {
          padding-bottom: 20px;
      }
      
      .invoice-box table tr.item td{
          border-bottom: 1px solid #eee;
      }
      
      .invoice-box table tr.item.last td {
          border-bottom: none;
      }
      
      .invoice-box table tr.total td:nth-child(2) {
          border-top: 2px solid #eee;
          font-weight: bold;
      }
      
      @media only screen and (max-width: 600px) {
          .invoice-box table tr.top table td {
              width: 100%;
              display: block;
              text-align: center;
          }
          
          .invoice-box table tr.information table td {
              width: 100%;
              display: block;
              text-align: center;
          }
      }
      
      /** RTL **/
      .rtl {
          direction: rtl;
          font-family: Tahoma, 'Helvetica Neue', 'Helvetica', Helvetica, Arial, sans-serif;
      }
      
      .rtl table {
          text-align: right;
      }
      
      .rtl table tr td:nth-child(2) {
          text-align: left;
      }
      </style>
  </head>
  
  <body>
      <div class="invoice-box">
          <table cellpadding="0" cellspacing="0">
              <tr class="top">
                  <td colspan="2">
                      <table>
                          <tr>
                              <td class="title">
                                  <img src="https://ricengrills.com.au/public/web/images/rice-n-grills-logo.svg" style="width:100%; max-width:300px;">
                              </td>
                              
                              <td>
                                  Bk.ID           : ${booking_id}<br>
                                  Created Date    : ${moment(created_at).format('YYYY-MM-DD')}<br>
                                  Scheduled Date  : ${moment(scheduled_date).format('YYYY-MM-DD')}<br>
                                  Shift Selected  : ${shift_name}<br>
                                  Del. Type       : ${delivery_type}
                              </td>
                          </tr>
                      </table>
                  </td>
              </tr>
              
              <tr class="information">
                  <td colspan="2">
                      <table>
                          <tr>
                              <td>
                                ${address_html}
                              </td>
                              
                              <td>
                                  ${name}<br>
                                  ${mobile}<br>
                                  ${email}
                              </td>
                          </tr>
                      </table>
                  </td>
              </tr>
              
              <tr class="heading">
                  <td>
                      Payment Method
                  </td>                  
                  <td>
                      Amount
                  </td>
              </tr>
              
              ${rng_credits_html}
              ${square_payment_html}
              ${coupon_html}

              <tr class="heading">
                  <td>
                      Item
                  </td>
                  
                  <td>
                      Price
                  </td>
              </tr>              
              ${orders_html}
              <tr class="item">
                <td>
                    Delivery Charge
                </td>
                
                <td>
                    $${delivery_charge.toFixed(2)}
                </td>
              </tr>
              <tr class="item last">
                  <td>
                      Service Charge
                  </td>
                  
                  <td>
                      $${service_charge.toFixed(2)}
                  </td>
              </tr>
              
              <tr class="total">
                  <td></td>                  
                  <td>
                     Total: $${total_price.toFixed(2)}
                  </td>
              </tr>
          </table>
      </div>
  </body>
  </html>
  `
}

sendOrderConfirm.process(async function (job, done) {
  let { booking_id, name, email, total } = job.data;

  if (!booking_id || !ObjectId.isValid(booking_id)) {
    return false
  }

  //check booking exists
  let booking_exists = await Order.find({
    _id: ObjectId(booking_id)
  }).estimatedDocumentCount()

  if (!booking_exists) {
    return false
  }
  //end check booking exists

  //get booking details
  let bookings = await Order.aggregate([
    {
      $match: {
        _id: ObjectId(booking_id)
      }
    },
    {
      $unwind: "$orders"
    },
    {
      $lookup: {
        from: "products",
        let: {
          product_id: "$orders.product_id"
        },
        pipeline: [
          {
            $match: {
              $expr: {
                $eq: ["$_id", "$$product_id"]
              }
            }
          },
          {
            $project: {
              name: 1
            }
          }
        ],
        as: "product"
      }
    },
    {
      $project: {
        _id: 1,
        booking_type: 1,
        booking_id: 1,
        user_id: 1,
        delivery_type: 1,
        address_id: 1,
        scheduled_date: 1,
        created_at: 1,
        shift_id: 1,
        coupon: 1,
        payment_id: 1,
        orders: {
          _id: "$orders._id",
          product_id: "$orders.product_id",
          price: "$orders.price",
          quantity: "$orders.quantity",
          product_name: {
            $arrayElemAt: ["$product.name", 0]
          }
        }
      }
    },
    {
      $group: {
        _id: "$_id",
        booking_type: {
          $first: "$booking_type"
        },
        orders: {
          $addToSet: "$orders"
        },
        booking_id: {
          $first: "$booking_id"
        },
        user_id: {
          $first: "$user_id"
        },
        delivery_type: {
          $first: "$delivery_type"
        },
        address_id: {
          $first: "$address_id"
        },
        scheduled_date: {
          $first: "$scheduled_date"
        },
        created_at: {
          $first: "$created_at"
        },
        shift_id: {
          $first: "$shift_id"
        },
        coupon: {
          $first: "$coupon"
        },
        payment_id: {
          $first: "$payment_id"
        }
      }
    },
    {//get payment details
      $lookup: {
        from: "payments",
        let: {
          payment_id: "$payment_id"
        },
        pipeline: [
          {
            $match: {
              $expr: {
                $eq: ["$_id", "$$payment_id"]
              }
            }
          }
        ],
        as: "payment_details"
      }
    },
    {//get shift details
      $lookup: {
        from: "settings",
        let: {
          shift_id: "$shift_id"
        },
        pipeline: [
          {
            $unwind: "$shift_times"
          },
          {
            $match: {
              $expr: {
                $eq: ["$shift_times._id", "$$shift_id"]
              }
            }
          },
          {
            $project: {
              _id: "$shift_times._id",
              name: "$shift_times.name",
            }
          }
        ],
        as: "shift_details"
      }
    },
    {//get shift details
      $lookup: {
        from: "transactions",
        let: {
          booking_id: "$booking_id"
        },
        pipeline: [
          {
            $match: {
              $expr: {
                $eq: ["$booking_id", "$$booking_id"]
              }
            }
          },
        ],
        as: "transaction_details"
      }
    },
    {//get address details
      $lookup: {
        from: "addresses",
        let: {
          address_id: "$address_id"
        },
        pipeline: [
          {
            $match: {
              $expr: {
                $eq: ["$_id", "$$address_id"]
              }
            }
          }
        ],
        as: "address_details"
      }
    },
    {//get user details
      $lookup: {
        from: "users",
        let: {
          user_id: "$user_id"
        },
        pipeline: [
          {
            $match: {
              $expr: {
                $eq: ["$_id", "$$user_id"]
              }
            }
          },
          {
            $project: {
              name: 1,
              mobile: 1,
              email: 1
            }
          }
        ],
        as: "user_details"
      }
    },
    {
      $addFields: {
        payment_details: {
          $arrayElemAt: ["$payment_details", 0]
        },
        shift_details: {
          $arrayElemAt: ["$shift_details", 0]
        },
        transaction_details: {
          $arrayElemAt: ["$transaction_details", 0]
        },
        address_details: {
          $arrayElemAt: ["$address_details", 0]
        },
        user_details: {
          $arrayElemAt: ["$user_details", 0]
        }
      }
    }
  ])

  // let html = invoicehtml(bookings[0])
  // let pdfbuffer = ""
  // let pdf = require('html-pdf');
  // pdf.create(html).toBuffer(async (err, buffer)=> {
  //   // console.log(orders)
   
  // });

  await neworder_confirmed({
    name,
    to_email: email,
    order_id: bookings[0]._id
  });
  console.log(`order email send to ${name}`);



  //notifications
  let admins = await Admin.find({
    delete_status: false,
  });

  let adminFcm = [];

  admins.forEach((admin) => {
    if (admin.device_token) {
      adminFcm.push(admin.device_token);
    }
  });

  if (adminFcm.length > 0) {
    var i = 0;
    adminFcm.forEach((id) => {
      i++;
      let topic = "orderconfirm";
      let message = {
        to: id,
        priority: "high",
        notification: {
          title: "New Order Confirmed",
          body: `New order ${bookings[0].booking_id}  is confirmed`,
          image: "",
        },
        data: {},
        topic,
      };

      //promise style
      fcm
        .send(message)
        .then(function (response) {
          console.log("Successfully sent with response: ", response);
        })
        .catch(function (err) {
          console.log("Something has gone wrong!");
          console.error(err);
        });
      job.progress(i);
    });
  }
  done();
});

sendDriverFoodRequest.process(async function (job, done) {
  let { driver_id, food_request_id } = job.data;
  if(!food_request_id || !ObjectId.isValid(food_request_id)) {
    return false
  }

  let [ admins, driver_details ] = await Promise.all([
    Admin.find({
      delete_status: false,
    }),
    Driver.findOne({
      _id: driver_id
    })
  ])
  // let admins = await Admin.find({
  //   delete_status: false,
  // });

  // let driver_details = await Driver.findOne({
  //   _id: driver_id
  // })

  let adminFcm = [];

  admins.forEach((admin) => {
    if (admin.device_token) {
      adminFcm.push(admin.device_token);
    }
  });

  if(adminFcm.length) {
    var i = 0
    adminFcm.forEach((id) => {
      i++;
      let topic = "Stock Request";
      let message = {
        to: id,
        priority: "high",
        notification: {
          title: "Stock Request From Driver",
          body: `New Stock Request from ${driver_details.name}`,
          image: "",
        },
        data: {},
        topic,
      };

      //promise style
      fcm
        .send(message)
        .then(function (response) {
          console.log("Successfully sent with response: ", response);
        })
        .catch(function (err) {
          console.log("Something has gone wrong!");
          console.error(err);
        });
      job.progress(i);
    });
  }
  done()
});

sendCpFoodRequest.process( async (job, done) => {
  let { collectionpoint_id } = job.data
  if(!collectionpoint_id) {
    return false
  }

  let admins = await Admin.find({
    delete_status: false
  })
  
  let cp = await CollectionPoint.findOne({
    _id: collectionpoint_id
  })

  let adminFcm = []

  admins.forEach((admin) => {
    if(admin.device_token) {
      adminFcm.push(admin.device_token)
    }
  })

  if(adminFcm.length) {
    var i = 0
    adminFcm.forEach((id) => {
      i++
      let topic = "Stock Request From Collection Point"
      let message = {
        to: id,
        priority: 'high',
        notification: {
          title: "Stock Request from collection point",
          body: `New stock request from colloection point ${cp.name}`,
          image: "",
        },
        data: {},
        topic,
      };

      fcm.send(message)
        .then( (response) => {
          console.log("Successfully sent with response: ", response)
        })
        .catch( (err) => {
          console.log(err)
        })
      job.progress(i)
    })
  }
  done()
})

module.exports = {
  adminNotificationQueue,
  driverJobNotificationQueue,
  addCreditByReferal,
  sendJobApproval,
  sendOrderConfirm,
  sendDriverFoodRequest,
  sendCpFoodRequest
};
