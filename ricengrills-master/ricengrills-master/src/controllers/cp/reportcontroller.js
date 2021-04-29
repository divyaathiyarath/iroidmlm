const mongoose = require("mongoose");
const Cpsales = mongoose.model("cp_sales")
const paginate = require('express-paginate')
const _ = require("underscore")
let ObjectId = mongoose.Types.ObjectId;
const Collectionpoint = mongoose.model("collectionpoints")
const Bookings = mongoose.model("bookings")
const Excel = require("exceljs");
let { getComingShift } = require('./dashboardController');

exports.listCpstocks = async(req,res)=>{  
    const id = req.session._id
    let { current_shift: shift_id } = await getComingShift()
    const startOfDay = new Date(new Date().setUTCHours(0, 0, 0, 0))
    const endOfDay = new Date(new Date().setUTCHours(23, 59, 59, 999))
    let {search,page,limit} = req.query
    if (typeof limit == "undefined") {
        limit = 10;
      }
      if (typeof page == "undefined") {
        page = 1;
      }
      let skip = 0;
      if (page > 1) {
          skip = (page - 1) * limit
      }

        let query = [];
        if (search) {
          let regex = { $regex: new RegExp(".*" + search.trim() + ".*", "i") };
          query.push({
            $match: {
              $or: [
                { booking_id: regex },
                
              ],
            },
          });
        }
        query.push(
        {
            $match:{
                delete_status: {
                  $ne: true,
                },
                collectionpoint_id:ObjectId(id),
                shift_id: ObjectId(shift_id),
                date:{$gte:startOfDay,$lte:endOfDay}
            },
        },
        {
          $lookup: {
            from: "products",
            let: { products: "$products" },
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
                    $and: [
                      { $eq: ["$_id", "$products.product_id"] },
                      { $eq: ["$is_regular", true] },
                    ],
                  },
                },
              },
              {
                $project: {
                  _id: 1,
                  name: 1,
                  cover_pic: 1,
                  type: 1,
                  image: 1,
                  quantity: "$products.stock",
                },
              },
            ],
            as: "products",
          },
        },
        {
            $sort:{"date": -1}
        });
      
        const sales = await Cpsales.aggregate([...query, {
            $skip: skip
          }, {
            $limit: limit
          }]);
          console.log(sales);

    let itemCount = await Cpsales.aggregate([...query,
            {
            $count:"count"
            }
    ]);
    if (itemCount.length > 0) {
        itemCount = itemCount[0].count;
        console.log(itemCount)
      } else {
        itemCount = 0;
      }
      const pageCount = Math.ceil(itemCount / limit);
      let data = {
        sales,
        search,
        itemCount,
        pageCount,
        pages: paginate.getArrayPages(req)(5, pageCount, page),
        activePage: page,
      }
        res.render("cp/stocks/log",data);
    }


    exports.collectionpointExcel = async(req,res)=>{
        const id = req.session._id
        let { current_shift: shift_id } = await getComingShift()
        console.log(shift_id)
        const startOfDay = new Date(new Date().setUTCHours(0, 0, 0, 0))
        const endOfDay = new Date(new Date().setUTCHours(23, 59, 59, 999))
        console.log(startOfDay,endOfDay)
        let cpsales = await Cpsales.aggregate([
          {
            $match:{
              collectionpoint_id :ObjectId(id),
              shift_id: ObjectId(shift_id),
              date: {$gte: startOfDay, $lt: endOfDay}
            },
          },
          {
            $lookup:{
              from:"products",
              let:{products:"$products"},
              pipeline:[
                {
                  $addFields:{
                    products:"$$products"
                  }, 
                },{
                  $unwind:"$products",
                },{
                  $match: {
                    $expr: {
                        $and: [{ $eq: ["$_id", "$products.product_id"] }],
                    },
                },
                },{
                  $project: {
                      _id: 1,
                      name: 1,
                      cover_pic: 1,
                      type: 1,
                      image: 1,
                      price:1,
                      stock: "$products.stock",
                  },
              },
              ],
              as:"products",
            }
          },{
            $sort:{"date":-1}
          }
        ])
      // console.log(cpsales);
      let collectionpoint =await Collectionpoint.aggregate([{
        $match:{
          _id:ObjectId(id)
        }
      },{
        $project:{
          name:1,
          email:1,
        }
      },
      ],)
      collectionpoint.forEach(cp=>{
        name = cp.name
      })
      console.log(name)
        const bookings = await Bookings.aggregate([
          {
              $match:{
                  collectionpoint_id:ObjectId(id),
                  shift_id:ObjectId(shift_id),
                  created_at: {$gte: startOfDay, $lt: endOfDay}
              },
          },
          {
            $lookup: {
              from: "products",
              let: { orders: "$orders" },
              pipeline: [
                {
                  $addFields: {
                    orders: "$$orders",
                  },
                },
                {
                  $unwind: "$orders",
                },
                {
                  $match: {
                    $expr: {
                      $and: [
                        { $eq: ["$_id", "$orders.product_id"] },
                        { $eq: ["$is_regular", true] },
                      ],
                    },
                  },
                },
                {
                  $project: {
                    _id: 1,
                    name: 1,
                    cover_pic: 1,
                    type: 1,
                    image: 1,
                    quantity: "$orders.quantity",
                  },
                },
              ],
              as: "products",
            },
          },
          
        ]);
        console.log(bookings)
        const workbooks = new Excel.Workbook();
        const worksheet = workbooks.addWorksheet(`${name}`, {
            properties: { tabColor: { argb: "FFC0000" } },
          });
          worksheet.columns = [
            { header: "ID", key: "booking_id", width: 20 },
            { header: "Type", key: "booking_type", width: 20 },
            { header: "delivery type", key: "delivery_type", width: 20 },
            { header: "prducts", key: "products._id", width: 20 },
          ];
        
        bookings.forEach(booking=>{
          let product_headers = [];
            booking.products.forEach((product)=>{
              product_headers.push(
                product.name +"-"+ product.quantity,
              )}
            ) 
          const rows =[
            booking.booking_id,
            booking.booking_type,
            booking.delivery_type,
            product_headers.join(',')
          ]
          console.log(rows)
          worksheet.addRow(rows)
        })
        cpsales.forEach((cpsale)=>{
          let product_headers2 = [];
          cpsale.products.forEach((product)=>{
            product_headers2.push(
              product.name + "-" + product.stock
            )
          })
          const rows = [
            cpsale.booking_id,
            booking_type="REALTIME",
            delivery_type ="COLLECTIONPOINT",
            product_headers2.join(',')
          ]
          worksheet.addRow(rows)
        })
        await workbooks.xlsx
          .writeFile(`public/reports/cp-${req.session._id}.xlsx`)
          .then(() => {
            return res.redirect(
              res.locals.asset_url + `/public/reports/cp-${req.session._id}.xlsx`
            );
          })
          .catch((err) => {
            return res.redirect(res.locals.app_url + `/dashboard`);
          });
      }