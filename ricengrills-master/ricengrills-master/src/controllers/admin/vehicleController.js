const mongoose = require("mongoose");
let ObjectId = mongoose.Types.ObjectId;
const paginate = require("express-paginate");

const Vehicle = mongoose.model("vehicles");

const {
  validateRefillerVehicleInputs,
} = require("../../validators/vehicleValidator");
const insuranceUpload = require("../../utils/uploads/insuranceUpload");

//add vehicle
exports.new = async (req, res) => {
  return res.render("admin/vehicles/new");
};
//add vehicle
exports.save = async (req, res) => {
  try {
    await insuranceUpload(req, res);
  } catch (err) {
    console.log(err.message);
    return res.json({ status: false, message: "Could not upload file" });
  }

  const { errors, isValid } = validateRefillerVehicleInputs(req.body);
  if (!isValid) {
    return res.json({ status: false, errors });
  }

  // const IS_VEHICLE_EXISTS = await this.checkVehicleExists(registration_number);
  // if (IS_VEHICLE_EXISTS) {
  //   return res.json({
  //     status: false,
  //     message: "This vehicle is already registered",
  //   });
  // }

  try {
    let { registration_number, insurance_validity, type } = req.body;
    let { insurance } = req.files;

    if (typeof insurance != "undefined" && insurance.length > 0) {
      insurance = insurance[0].destination + "/" + insurance[0].filename;
    }

    vehicle = new Vehicle({
      registration_number,
      insurance_validity,
      insurance,
      type,
    });
    await vehicle.save();
    return res.json({
      status: true,
      message: "Vehicle saved successfully",
    });
  } catch (err) {
    return res.json({
      status: false,
      message: "Could not add vehicle",
    });
  }
};
//list vehicles
exports.list = async (req, res) => {
  let { search, page, limit } = req.query;
  if (typeof limit == "undefined") {
    limit = 10;
  }
  if (typeof page == "undefined") {
    page = 1;
  }

  let  skip =0 
  if(page > 1){
    skip = (page - 1) * limit
  }

  let query = [];
  if (search) {
    let regex = { $regex: new RegExp(".*" + search.trim() + ".*", "i") };
    query.push({
      $match: {
        $or: [
          {
            registration_number: regex,
          },
        ],
      },
    });
  }
  query.push({
    $match: {
      delete_status: {
        $ne: true,
      },
      type: 'REFILLING'
    },
  });

  let vehicles = await Vehicle.aggregate([
    ...query,
    {
      $skip: skip,
    },
    {
      $limit: limit,
    },
  ]);

  let itemCount = await Vehicle.aggregate([
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
    vehicles,
    itemCount,
    pageCount,
    pages: paginate.getArrayPages(req)(5, pageCount, page),
    activePage: page,
  };
  return res.render("admin/vehicles/list", data);
};

exports.checkVehicleExists = async (registration_number) => {
  vehicle = await Vehicle.findOne({
    registrtation_number,
    delete_status: false,
  }).countDocuments();
  return vehicle;
};

exports.changeVehicle = async (req, res) => {
  const { id } = req.params;
  vehicle = await Vehicle.findOne({
    _id: id,
  });
  let data = {
    vehicle,
  };
  console.log(data);
  return res.render("admin/vehicles/changeVehicle", data);
};
exports.editVehicle = async (req, res) => {
  try {
    await insuranceUpload(req, res);
  } catch (err) {
    console.log(err.message);
    return res.json({ status: false, message: "Could not upload file" });
  }

  const { errors, isValid } = validateRefillerVehicleInputs(req.body);
  if (!isValid) {
    return res.json({ status: false, errors });
  }

  try {
    let { insurance } = req.files;

    if (typeof insurance != "undefined" && insurance.length > 0) {
      insurance = insurance[0].destination + "/" + insurance[0].filename;
    }
    const { id } = req.params;
    vehicle = await Vehicle.findById({ _id: id });
    vehicle.registration_number = req.body.registration_number;
    vehicle.insurance = insurance;
    vehicle.insurance_validity = req.body.insurance_validity;
    vehicle.type = req.body.type;
    await vehicle.save();
    return res.json({
      status: true,
      message: "Vehicle saved successfully",
    });
  } catch (err) {
    return res.json({
      status: false,
      message: "Could not add vehicle",
    });
  }
};

exports.delete = async (req, res) => {
  const { vehicle } = req.body;
  await Vehicle.updateOne(
    {
      _id: ObjectId(vehicle),
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
    message: "Vehicle deleted successfully",
  });
};

exports.listDeliveryVehicles = async(req,res)=>{
  let {search ,limit, page } = req.query
  if (typeof limit == "undefined") {
    limit = 10;
  }
  if (typeof page == "undefined") {
    page = 1;
  }
  let skip = 0
  if(page > 1){
    skip = (page - 1) * limit
  }

  let query = [];
  if (search) {
    let regex = { $regex: new RegExp(".*" + search.trim() + ".*", "i") };
    query.push({
      $match: {
        $or: [
          {
            registration_number: regex,
          },
        ],
      },
    });
  }

  query.push({
    $match:{
      delete_status: {
        $ne: true
      },
      type: "DELIVERY"
    }
  })
  const vehicles = await Vehicle.aggregate([...query,
    {
      $skip:skip
    },
    {
      $limit:limit
    }
  ])
   let itemCount = await Vehicle.aggregate([
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
    vehicles,
    itemCount,
    pageCount,
    pages: paginate.getArrayPages(req)(5, pageCount, page),
    activePage: page,
  };
  return res.render("admin/vehicles/list2",data)
}