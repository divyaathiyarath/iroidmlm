const mongoose = require("mongoose");
var Excel = require("exceljs");
let ObjectId = mongoose.Types.ObjectId;
const CollectionPoint = mongoose.model("collectionpoints");
const Address = mongoose.model("addresses");
const Suburb = mongoose.model("suburbs");
const Setting = mongoose.model("settings");
const Product = mongoose.model("products");
const ExcessStock = mongoose.model("excessstocks");
const CpExcessStock = mongoose.model("stock_requests_cp");
const Transferstock = mongoose.model("stock_transfers");
const _ = require("underscore");
const paginate = require("express-paginate");

const {
  validateCollectionPointInputs,
} = require("../../validators/collectionPointValidator");
const collectionpointUpload = require("../../utils/uploads/collectionpointUpload");
const {
  newCpCreatedMail,
  cp_rejected,
  cp_approved,
} = require("../../utils/emails/admin/collection_points");

exports.list = async (req, res) => {
  let { search, page, limit } = req.query;
  if (typeof limit == "undefined") {
    limit = 10;
  }
  if (typeof page == "undefined") {
    page = 1;
  }
  let skip = 0;
  if (page > 1) {
    skip = (page - 1) * limit;
  }
  let query = [];
  if (search) {
    let regex = { $regex: new RegExp(".*" + search.trim() + ".*", "i") };
    query.push({
      $match: {
        $or: [
          { name: regex },
          { contact_name: regex },
          { email: regex },
          { mobile: regex },
        ],
      },
    });
  }
  query.push({
    $match: {
      delete_status: {
        $ne: true,
      },
      approved: true,
    },
  },
    {
      $lookup: {
        from: "addresses",
        let: {
          cp_id: "$_id"
        },
        pipeline: [
          {
            $match: {
              $expr: {
                $eq: ["$collectionpoint_id", "$$cp_id"]
              }
            }
          },
          {
            $lookup: {
              from: "suburbs",
              let: {
                suburb_id: "$suburb_id"
              },
              pipeline: [
                {
                  $match: {
                    $expr: {
                      $eq: ["$_id", "$$suburb_id"]
                    }
                  }
                },
              ],
              as: 'suburb'
            }
          },
          {
            $project: {
              address_line1: 1,
              address_line2: 1,
              suburb: {
                $arrayElemAt: ["$suburb", 0]
              }
            }
          }
        ],
        as: "address"
      }
    },
    {
      $addFields: {
        address: {
          $arrayElemAt: ["$address", 0]
        }
      },
    },
    {
      $sort: {
        _id: -1
      }
    }
  );

  let collectionpoints = await CollectionPoint.aggregate([
    ...query,
    {
      $skip: skip,
    },
    {
      $limit: limit,
    },
  ]);

  let itemCount = await CollectionPoint.aggregate([
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
    search,
    collectionpoints,
    itemCount,
    pageCount,
    pages: paginate.getArrayPages(req)(5, pageCount, page),
    activePage: page,
  };
  return res.render("admin/collectionpoints/list", data);
};

exports.pendingList = async (req, res) => {
  let { search, page, limit } = req.query;
  if (typeof limit == "undefined") {
    limit = 10;
  }
  if (typeof page == "undefined") {
    page = 1;
  }
  let skip = 0;
  if (page > 1) {
    skip = (page - 1) * limit;
  }
  let query = [];
  if (search) {
    let regex = { $regex: new RegExp(".*" + search.trim() + ".*", "i") };
    query.push({
      $match: {
        $or: [
          { name: regex },
          { contact_name: regex },
          { email: regex },
          { mobile: regex },
        ],
      },
    });
  }
  query.push({
    $match: {
      delete_status: {
        $ne: true,
      },
      approved: false,
    },
  },
    {
      $lookup: {
        from: "addresses",
        let: {
          cp_id: "$_id"
        },
        pipeline: [
          {
            $match: {
              $expr: {
                $eq: ["$collectionpoint_id", "$$cp_id"]
              }
            }
          },
          {
            $lookup: {
              from: "suburbs",
              let: {
                suburb_id: "$suburb_id"
              },
              pipeline: [
                {
                  $match: {
                    $expr: {
                      $eq: ["$_id", "$$suburb_id"]
                    }
                  }
                },
              ],
              as: 'suburb'
            }
          },
          {
            $project: {
              address_line1: 1,
              address_line2: 1,
              suburb: {
                $arrayElemAt: ["$suburb", 0]
              }
            }
          }
        ],
        as: "address"
      }
    }, {
    $addFields: {
      address: {
        $arrayElemAt: ["$address", 0]
      }
    }
  });

  let collectionpoints = await CollectionPoint.aggregate([
    ...query,
    {
      $skip: skip,
    },
    {
      $limit: limit,
    },
  ]);

  let itemCount = await CollectionPoint.aggregate([
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
    search,
    collectionpoints,
    itemCount,
    pageCount,
    pages: paginate.getArrayPages(req)(5, pageCount, page),
    activePage: page,
  };
  return res.render("admin/collectionpoints/pending", data);
};

exports.approveCollectionPoint = async (req, res) => {
  let { collection_point } = req.body;
  let collectionpoint = await CollectionPoint.findOne({
    _id: ObjectId(collection_point),
  });
  if (collectionpoint) {
    collectionpoint.approved = true;
    collectionpoint.rejected = false;
    let password = "rng" + Date.now();
    collectionpoint.setPassword(password);
    await collectionpoint.save();
    await cp_approved({
      name: collectionpoint.name,
      email: collectionpoint.email,
    });
    await newCpCreatedMail({
      name: collectionpoint.name,
      email: collectionpoint.email,
      password,
      asset_url: res.locals.asset_url,
      app_url: res.locals.cp_url,
    });
  }
  return res.json({
    status: true,
    message: "Collection Point approved successfully",
  });
};

exports.rejectCollectionPoint = async (req, res) => {
  let { collection_point } = req.body;
  let collectionpoint = await CollectionPoint.findOne({
    _id: ObjectId(collection_point),
  });
  if (collectionpoint) {
    collectionpoint.approved = false;
    collectionpoint.rejected = true;
    await collectionpoint.save();
  }
  await cp_rejected({
    name: collectionpoint.name,
    email: collectionpoint.email,
    asset_url: res.locals.asset_url,
    app_url: res.locals.cp_url,
  });
  return res.json({
    status: true,
    message: "Collection Point rejected successfully",
  });
};

exports.new = async (req, res) => {
  let suburbs = await Suburb.find({ delete_status: false });
  return res.render("admin/collectionpoints/new", { suburbs });
};

exports.save = async (req, res) => {
  try {
    await collectionpointUpload(req, res);
  } catch (err) {
    return res.json({ status: false, message: "Could not upload image" });
  }

  const { errors, isValid } = await validateCollectionPointInputs(req.body);
  if (!isValid) {
    return res.json({ status: false, errors });
  }

  try {
    let {
      name,
      contact_name,
      email,
      mobile,
      address_line1,
      address_line2,
      lat,
      lng,
      suburb_id,
      starttime,
      closetime
    } = req.body;
    let { image } = req.files;
    console.log(starttime, closetime)
    if (typeof image != "undefined" && image.length > 0) {
      image = image[0].destination + "/" + image[0].filename;
    }

    let is_email_exists = await this.checkEmailExists(email);
    if (is_email_exists) {
      return res.json({ status: false, message: "Email already exists" });
    }

    let is_mobile_exists = await this.checkMobileExists(mobile);
    if (is_mobile_exists) {
      return res.json({ status: false, message: "Mobile already exists" });
    }

    cp = new CollectionPoint({
      name,
      contact_name,
      email,
      mobile,
      image,
      approved: true,
      starttime,
      closetime
    });
    let password = "rng" + Date.now();
    cp.setPassword(password);
    await cp.save();

    if (cp._id) {
      let address = new Address({
        collectionpoint_id: cp._id,
        type: "COLLECTION_POINT",
        address_line1,
        address_line2,
        suburb_id,
        location: {
          coordinates: [lng, lat],
          type: "Point",
        },
      });
      await address.save();
    }

    await newCpCreatedMail({
      name: cp.name,
      email: cp.email,
      password,
      asset_url: res.locals.asset_url,
      app_url: res.locals.cp_url,
    });

    return res.json({
      status: true,
      message: "Collection point saved successfully",
    });
  } catch (err) {
    console.log(err);
    return res.json({
      status: false,
      message: "Could not save collection point",
    });
  }
};

exports.delete = async (req, res) => {
  let { collection_point } = req.body;
  if (!collection_point) {
    return res.json({ status: false, message: "Collection Point is required" });
  }
  collection_point = await CollectionPoint.findOne({
    _id: collection_point,
    delete_status: false,
  });
  if (!collection_point) {
    return res.json({ status: false, message: "Collection Point not exists" });
  }

  await CollectionPoint.updateOne(
    {
      _id: ObjectId(collection_point._id),
    },
    {
      $set: {
        delete_status: true,
        deleted_at: Date.now(),
      },
    }
  );
  return res.json({
    status: true,
    message: "Collection Point deleted successfully",
  });
};

exports.update = async (req, res) => {
  try {
    await collectionpointUpload(req, res);
  } catch (err) {
    // console.log(err)
    return res.json({ status: false, message: "Could not upload file" });
  }

  const { errors, isValid } = validateCollectionPointInputs(req.body);
  if (!isValid) {
    return res.json({ status: false, errors });
  }

  try {
    let {
      _id,
      name,
      contact_name,
      email,
      mobile,
      address_line1,
      address_line2,
      lat,
      lng,
      suburb_id,
      starttime,
      closetime
    } = req.body;
    let { image } = req.files;

    let cp = await CollectionPoint.findOne({ _id });
    if (!cp) {
      return res.json({ status: false, message: "Collection Point not found" });
    }

    if (typeof image != "undefined" && image.length > 0) {
      image = image[0].destination + "/" + image[0].filename;
    }

    let is_email_exists = await this.checkEmailExists(email, _id);
    if (is_email_exists) {
      return res.json({ status: false, message: "Email already exists" });
    }

    let is_mobile_exists = await this.checkMobileExists(mobile, _id);
    if (is_mobile_exists) {
      return res.json({ status: false, message: "Mobile already exists" });
    }
    if (image) {
      cp.image = image;
    }
    cp.name = name;
    cp.contact_name = contact_name;
    cp.email = email;
    cp.mobile = mobile;
    cp.starttime = starttime,
      cp.closetime = closetime
    address = await Address.findOne({ collectionpoint_id: cp._id });
    address.address_line1 = address_line1;
    address.address_line2 = address_line2;
    if (suburb_id) {
      address.suburb_id = suburb_id;
    }
    address.location = {
      coordinates: [lng, lat],
      type: "Point",
    };

    await cp.save();
    await address.save();

    return res.json({
      status: true,
      message: "Collection point updated successfully",
    });
  } catch (err) {
    console.log(err);
    return res.json({
      status: false,
      message: "Could not update collection point",
    });
  }
};

exports.edit = async (req, res) => {
  let { collectionpoint } = req.params;
  let cp = await CollectionPoint.findOne({ _id: ObjectId(collectionpoint) });
  let address = await Address.findOne({
    collectionpoint_id: ObjectId(collectionpoint),
  });
  let suburbs = await Suburb.find({ delete_status: false });
  if (!cp) {
    res.redirect(res.locals.app_url + "/collectionpoints/new");
  }
  return res.render("admin/collectionpoints/edit", { cp, address, suburbs });
};

exports.checkEmailExists = async (email, id = null) => {
  let query = { email, delete_status: false };
  if (id) {
    query._id = {
      $ne: id,
    };
  }
  cp = await CollectionPoint.findOne(query).countDocuments();
  return cp;
};

exports.checkMobileExists = async (mobile, id = null) => {
  let query = { mobile, delete_status: false };
  if (id) {
    query._id = {
      $ne: id,
    };
  }
  cp = await CollectionPoint.findOne(query).countDocuments();
  return cp;
};

exports.downloadCollectionPointExcel = async (req, res) => {
  let suburbs = await Suburb.aggregate([
    {
      $match: {
        delete_status: false,
      },
    },
    {
      $lookup: {
        from: "collectionpoints",
        let: { suburb_id: "$_id" },
        pipeline: [
          {
            $lookup: {
              from: "addresses",
              let: { collectionpoint_id: "$_id" },
              pipeline: [
                {
                  $match: {
                    $expr: {
                      $and: [
                        {
                          $eq: ["$collectionpoint_id", "$$collectionpoint_id"],
                        },
                        { $gte: ["$delete_status", false] },
                      ],
                    },
                  },
                },
              ],
              as: "address",
            },
          },
          {
            $addFields: {
              suburb_id: {
                $arrayElemAt: ["$address.suburb_id", 0],
              },
            },
          },
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$suburb_id", "$$suburb_id"] },
                  { $gte: ["$delete_status", false] },
                ],
              },
            },
          },
        ],
        as: "collectionpoints",
      },
    },
  ]);
  let setting = await Setting.findOne();
  let shifts = setting.shift_times;
  let excess_stock_headers = [];
  shifts.forEach((shift) => {
    excess_stock_headers.push({
      header: shift.name + `(${shift.time})`,
      key: shift._id,
      width: 20,
    });
  });

  var workbook = new Excel.Workbook();

  suburbs.forEach((suburb) => {
    var worksheet = workbook.addWorksheet(`${suburb.name}`, {
      properties: { tabColor: { argb: "FFC0000" } },
    });
    worksheet.columns = [
      { header: "ID", key: "_id", width: 35 },
      { header: "Name", key: "name", width: 35 },
      { header: "Contact Name", key: "contact_name", width: 35 },
      { header: "Email", key: "email", width: 35 },
      { header: "Mobile", key: "mobile", width: 35 },
      ...excess_stock_headers,
    ];

    let { collectionpoints } = suburb;
    if (typeof collectionpoints != "undefined" && collectionpoints.length > 0) {
      collectionpoints.forEach((cp) => {
        worksheet.addRow({
          _id: cp._id,
          name: cp.name,
          contact_name: cp.contact_name,
          email: cp.email,
          mobile: cp.mobile,
        });
      });
    }
  });

  workbook.xlsx
    .writeFile(`public/reports/cp-${req.session._id}.xlsx`)
    .then(() => {
      return res.redirect(
        res.locals.asset_url + `/public/reports/cp-${req.session._id}.xlsx`
      );
    })
    .catch((err) => {
      return res.redirect(res.locals.app_url + `/collectionpoints`);
    });
};

exports.excessstock = async (req, res) => {
  let { collectionpoint_id } = req.params;
  let cp = await CollectionPoint.findOne({ _id: ObjectId(collectionpoint_id) });
  if (!cp) {
    res.redirect(res.locals.app_url + "/collectionpoints");
  }

  let stocks = await ExcessStock.aggregate([
    {
      $match: {
        collectionpoint_id: ObjectId(cp._id),
      },
    },
    {
      $lookup: {
        from: "settings",
        let: { shift_id: "$shift_id" },
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
      $match: {
        $expr: {
          $and: [{ $gt: [{ $size: "$shift" }, 0] }],
        },
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
                  { $eq: ["$delete_status", false] },
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
              quantity: {
                $ifNull: ["$products.quantity", 0]
              },
            },
          },
        ],
        as: "products",
      },
    },
    {
      $addFields: {
        shift: { $arrayElemAt: ["$shift", 0] },
      },
    },
  ]);
  return res.render("admin/collectionpoints/excess_stock", { cp, stocks });
};

exports.newstock = async (req, res) => {
  let { collectionpoint_id } = req.params;
  let cp = await CollectionPoint.findOne({ _id: ObjectId(collectionpoint_id) });

  if (!cp) {
    res.redirect(res.locals.app_url + "/collectionpoints");
  }

  let setting = await Setting.findOne();
  let { shift_times: shifts } = setting;
  let products = await Product.find({ is_regular: true, delete_status: false });

  return res.render("admin/collectionpoints/newstock", {
    cp,
    shifts,
    products,
  });
};

exports.savestock = async (req, res) => {
  let { collectionpoint_id, shift_id, products } = req.body;
  let stock = await ExcessStock.findOne({
    collectionpoint_id: ObjectId(collectionpoint_id),
    shift_id: ObjectId(shift_id),
  });
  if (!stock) {
    stock = new ExcessStock();
    stock.collectionpoint_id = collectionpoint_id;
    stock.shift_id = shift_id;
    await stock.save();
  }
  if (products) {
    var insert_products = [];
    _.map(products, function (quantity, product_id) {
      console.log({ quantity })
      if (quantity != "") {
        insert_products.push({
          product_id,
          quantity: +quantity,
        });
      }
    });
    if (insert_products.length <= 0) {
      return res.json({
        status: false,
        products,
        message: "Please select products"
      })
    }
    stock.products = insert_products;
    await stock.save();
  }
  return res.json({
    status: true,
    message: "Excess Stock updated successfully",
  });
};

exports.stockRequests = async (req, res) => {
  let { search, page, limit } = req.query;
  if (typeof limit == "undefined") {
    limit = 10;
  }
  if (typeof page == "undefined") {
    page = 1;
  }
  let skip = 0;
  if (page > 1) {
    skip = (page - 1) * limit;
  }

  let query = [];
  query.push(
    {
      $match: {
        delete_status: {
          $ne: true,
        },
        approve_status: false
      },
    },
    {
      $lookup: {
        from: "collectionpoints",
        let: { collectionpoint_id: "$collectionpoint_id" },
        pipeline: [
          {
            $match: {
              $expr: { $eq: ["$_id", "$$collectionpoint_id"] },
            },
          },
          {
            $project: {
              _id: 1,
              name: 1,
            },
          },
        ],
        as: "collection_point",
      },
    },
    {
      $addFields: {
        collectionpoint: {
          $arrayElemAt: ["$collection_point", 0]
        }
      }
    })
  if (search) {
    let regex = { $regex: new RegExp(".*" + search.trim() + ".*", "i") };
    query.push({
      $match: {
        $or: [
          { 'collection_point.name': regex }
        ],
      },
    });
  }
  query.push({
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
            quantity: "$products.quantity",
          },
        },
      ],
      as: "products",
    },
  },
    {
      $addFields: {
        collection_point: { $arrayElemAt: ["$collection_point", 0] },
      },
    }
  );

  const stocks = await CpExcessStock.aggregate([
    ...query,
    {
      $skip: skip,
    },
    {
      $limit: limit,
    },
    {
      $sort:{
        _id: -1
      }
    }
  ]);

  let itemCount = await CpExcessStock.aggregate([
    ...query,
    {
      $count: "count",
    },
  ]);
  console.log(itemCount);
  if (itemCount.length > 0) {
    itemCount = itemCount[0].count;
  } else {
    itemCount = 0;
  }

  const pageCount = Math.ceil(itemCount / limit);

  let data = {
    stocks,
    itemCount,
    pageCount,
    pages: paginate.getArrayPages(req)(5, pageCount, page),
    activePage: page,
    search
  };
  return res.render("admin/collectionpoints/stockcontrol", data);
};

exports.editStocks = async (req, res) => {
  let { _id } = req.params;
  console.log(_id);
  let setting = await Setting.findOne();
  let { shift_times: shifts } = setting;
  let stocks = await CpExcessStock.aggregate([
    {
      $match: {
        _id: ObjectId(_id),
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
              quantity: "$products.quantity",
            },
          },
        ],
        as: "products",
      },
    },
  ]);
  console.log(stocks);
  return res.render("admin/collectionpoints/editStock", { stocks, _id });
};

exports.deleteStock = async (req, res) => {
  const { stocks } = req.body;
  await CpExcessStock.updateOne(
    {
      _id: ObjectId(stocks),
    },
    {
      $set: {
        delete_status: true,
        deleted_at: Date.now(),
      },
    }
  );
  return res.json({
    status: true,
    message: "Stock deleted successfully",
  });
};

exports.stockupdates = async (req, res) => {
  let { products, id } = req.body;
  console.log(id);
  let stock = await CpExcessStock.findOne({
    _id: ObjectId(id),
  });
  console.log(stock);
  let transferstock = await Transferstock.findOne({
    _id: ObjectId(id),
  });
  if (!transferstock) {
    transferstock = new Transferstock();
    transferstock.collectionpoint_id = stock.collectionpoint_id;
    await transferstock.save();
  }
  // if (!stock) {
  //   stock = new CpExcessStock();
  //   await stock.save();
  // }
  console.log({ products });
  if (products) {
    var insert_products = [];
    _.map(products, function (stock, product_id) {
      insert_products.push({
        product_id,
        stock,
      });
    });
    transferstock.products = insert_products;
    transferstock.approve_status = false;
    transferstock.type = "COLLECTIONPOINT";
    await transferstock.save();
    stock.approve_status = true;
    await stock.save();
    return res.json({
      status: true,
      message: "Stock updated successfully",
    });
  }
};
