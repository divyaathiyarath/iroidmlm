const mongoose = require('mongoose')
const Excel = require("exceljs")
const moment = require("moment")
const paginate = require("express-paginate")
const ObjectId = mongoose.Types.ObjectId
const Company = mongoose.model('companies')
const TmpCompany = mongoose.model('temp_companies')
const Address = mongoose.model('addresses')
const Suburb = mongoose.model('suburbs')
const User = mongoose.model('users')
const { validateCompanyInputs } = require('../../validators/companyValidator')

exports.checkEmailExists = async (email, id = null) => {
    let query = { email, delete_status: false };
    if (id) {
        query._id = {
            $ne: id,
        };
    }
    cp = await Company.findOne(query).countDocuments();
    return cp;
};

exports.checkMobileExists = async (mobile, id = null) => {
    let query = { mobile, delete_status: false };
    if (id) {
        query._id = {
            $ne: id,
        };
    }
    cp = await Company.findOne(query).countDocuments();
    return cp;
};


exports.new = async (req, res) => {
    let suburbs = await Suburb.find({ delete_status: false });
    return res.render('admin/company/new', { suburbs })
}

exports.save = async (req, res) => {
    let { name, email, mobile, address_line1, address_line2, lat, lng, suburb_id } = req.body

    const { errors, isValid } = await validateCompanyInputs(req.body);
    if (!isValid) {
        return res.json({ status: false, errors });
    }

    if (email) {
        let is_email_exists = await this.checkEmailExists(email);
        if (is_email_exists) {
            return res.json({ status: false, message: "Email already exists" });
        }
    }

    if (mobile) {
        let is_mobile_exists = await this.checkMobileExists(mobile);
        if (is_mobile_exists) {
            return res.json({ status: false, message: "Mobile already exists" });
        }
    }

    try {

        let company = new Company({
            name,
            email,
            mobile
        })

        let address = new Address({
            address_line1,
            address_line2,
            location: {
                type: 'Point',
                coordinates: [
                    lng,
                    lat
                ]
            },
            suburb_id: ObjectId(suburb_id),
            type: "OFFICE",
            address_type: "OFFICE"
        })

        await company.save()
        address.company_id = company._id
        await address.save()

        return res.json({
            status: true,
            message: "Company registered successfully"
        })
    } catch (err) {
        return res.json({
            status: false,
            message: "Could not register company"
        })
    }

}

exports.edit = async (req, res) => {
    let { company_id } = req.params
    let suburbs = await Suburb.find({ delete_status: false });
    let company = await Company.findOne({ _id: ObjectId(company_id) })
    let address = await Address.findOne({ company_id: ObjectId(company_id) })
    return res.render('admin/company/edit', {
        suburbs,
        company,
        address
    })
}

exports.update = async (req, res) => {
    let { company_id, name, email, mobile, address_line1, address_line2, lat, lng, suburb_id } = req.body

    const { errors, isValid } = await validateCompanyInputs(req.body);
    if (!isValid) {
        return res.json({ status: false, errors });
    }

    if (email) {
        let is_email_exists = await this.checkEmailExists(email, company_id);
        if (is_email_exists) {
            return res.json({ status: false, message: "Email already exists" });
        }
    }

    if (mobile) {
        let is_mobile_exists = await this.checkMobileExists(mobile, company_id);
        if (is_mobile_exists) {
            return res.json({ status: false, message: "Mobile already exists" });
        }
    }

    try {
        let company = await Company.findOne({ _id: ObjectId(company_id) })
        let address = await Address.findOne({ company_id: ObjectId(company_id) })

        company.name = name
        company.email = email
        company.mobile = mobile

        address.address_line1 = address_line1
        address.address_line2 = address_line2
        address.location = {
            type: "Point",
            coordinates: [
                lng,
                lat
            ]
        }
        address.suburb_id = ObjectId(suburb_id)

        await company.save()
        await address.save()

        return res.json({
            status: true,
            message: "Company details updated successfully"
        })
    } catch (err) {
        return res.json({
            status: false,
            message: "Could not update company details"
        })
    }

}

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
                    { email: regex },
                    { mobile: regex }
                ],
            },
        });
    }
    query.push({
        $match: {
            delete_status: {
                $ne: true,
            },
        },
    },
        {
            $lookup: {
                from: "addresses",
                let: {
                    company_id: "$_id"
                },
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $eq: ["$company_id", "$$company_id"]
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
                                    { $eq: ['$_id', "$$user_id"] }
                                ]
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
                as: "user"
            }
        },
        {
            $addFields: {
                user: {
                    $arrayElemAt: ["$user", 0]
                }
            },
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

    let companies = await Company.aggregate([
        ...query,
        {
            $skip: skip,
        },
        {
            $limit: limit,
        },
    ]);

    let itemCount = await Company.aggregate([
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
        companies,
        itemCount,
        pageCount,
        pages: paginate.getArrayPages(req)(5, pageCount, page),
        activePage: page,
    };
    return res.render("admin/company/list", data);
}

exports.delete = async (req, res) => {
    let { company_id } = req.body
    if (company_id) {
        let company = await Company.findOne({ _id: ObjectId(company_id) })
        company.delete_status = true
        await company.save()
    }
    return res.json({
        status: true,
        message: "Company deleted successfully"
    })
}

const employeePagination = function (data) {
    return new Promise((resolve, reject) => {
        try {
            let { search, page, limit, company_id, count, skip } = data;
            if (count) {
                if (search) {
                    let regex = ".*" + search.trim() + ".*", i // { $regex: new RegExp(".*" + search.trim() + ".*", "i") };
                    User.find({
                        $or: [{ name: { $regex: regex } }, { email: { $regex: regex } }, { mobile: { $regex: regex } }]
                    },
                        {
                            company_id: ObjectId(company_id),
                            delete_status: false
                        }).countDocuments().then((data) => {
                            console.log({ data })
                            resolve(data)
                        }).catch((err) => {
                            console.log(err)
                            reject("Error in count query")
                        })
                } else {
                    User.find(
                        {
                            company_id: ObjectId(company_id),
                            delete_status: false
                        }).countDocuments().then((data) => {
                            console.log({ data })
                            resolve(data)
                        }).catch((err) => {
                            reject("Error in count query")
                        })
                }

            } else {
                let query = []
                if (search) {
                    let regex = { $regex: new RegExp(".*" + search.trim() + ".*", "i") };
                    query.push({
                        $match: {
                            $or: [
                                { name: regex },
                                { email: regex },
                                { mobile: regex }
                            ],
                        },
                    });
                }

                query.push(
                    {
                        $match: {
                            company_id: ObjectId(company_id),
                            delete_status: false
                        }
                    },
                    {
                        $project: {
                            name: 1,
                            email: 1,
                            mobile: 1
                        }
                    },
                    {
                        $lookup: {
                            from: "addresses",
                            let: {
                                user_id: "$_id"
                            },
                            pipeline: [
                                {
                                    $match: {
                                        $expr: {
                                            $eq: ["$user_id", "$$user_id"]
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
                    },
                    {
                        $skip: skip,
                    },
                    {
                        $limit: limit,
                    }
                )

                User.aggregate(query).then(function (data) {
                    console.log(data)
                    resolve(data)
                }).catch((err) => {
                    console.log(err)
                    reject("Error in employee query")
                })
            }
        } catch (err) {
            console.log(err)
            reject(new Error(`Couldn't get employee data`));
        }
    });
};

exports.employeelist = async (req, res) => {
    let { search, page, limit } = req.query;
    let { company_id } = req.params

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

    if (company_id) {
        let [employees, itemCount,] = await Promise.all([
            employeePagination({
                search,
                page,
                limit,
                company_id,
                skip,
                limit,
                count: false,
            }),
            employeePagination({
                search,
                page,
                limit,
                company_id,
                skip,
                limit,
                count: true
            })
        ])

        const pageCount = Math.ceil(itemCount / limit);
        return res.render('admin/company/listemploees', {
            search,
            employees,
            itemCount,
            pageCount,
            pages: paginate.getArrayPages(req)(5, pageCount, page),
            activePage: page,
        })
    } else {
        return res.redirect(res.locals.app_url + "/companies")
    }
}

exports.downloadOrderReport = async (req, res) => {

    let companies = await Company.aggregate([
        {
            $match: {
                delete_status: false,
            }
        },
        {
            $lookup: {
                from: "bookings",
                let: {
                    company_id: "$_id"
                },
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $and: [
                                    { $eq: ['$company_id', '$$company_id'] },
                                    { $eq: ['$scheduled_date', new Date(moment().format('YYYY-MM-DD'))] }
                                ]
                            }
                        }
                    },
                    {
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
                                            $and: [
                                                { $eq: ["$$shift_id", "$shift_times._id"] },
                                            ]
                                        }
                                    }
                                },
                                {
                                    $project: {
                                        _id: "$shift_times._id",
                                        name: "$shift_times.name",
                                        duration: "$shift_times.duration",
                                        time: "$shift_times.time"
                                    }
                                }
                            ],
                            as: "shift"
                        }
                    },
                    {
                        $addFields: {
                            shift: {
                                $arrayElemAt: ["$shift", 0]
                            }
                        }
                    },
                    {
                        $lookup: {
                            from: "addresses",
                            let: {
                                address_id: "$address_id"
                            },
                            pipeline: [
                                {
                                    $match: {
                                        $expr: {
                                            $and: [
                                                { $eq: ["$_id", "$$address_id"] }
                                            ]
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
                                                        $and: [
                                                            { $eq: ["$$suburb_id", "$_id"] }
                                                        ]
                                                    }
                                                }
                                            },
                                            {
                                                $project: {
                                                    _id: "$_id",
                                                    name: "$name",
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
                                }
                            ],
                            as: 'address'
                        }
                    },
                    {
                        $addFields: {
                            address: {
                                $arrayElemAt: ["$address", 0]
                            }
                        }
                    },
                    {
                        $lookup: {
                            from: "collectionpoints",
                            let: {
                                cp_id: "$collectionpoint_id"
                            },
                            pipeline: [
                                {
                                    $match: {
                                        $expr: {
                                            $and: [
                                                { $eq: ["$$cp_id", "$_id"] }
                                            ]
                                        }
                                    }
                                },
                                {
                                    $lookup: {
                                        from: "addresses",
                                        let: {
                                            collectionpoint_id: "$_id"
                                        },
                                        pipeline: [
                                            {
                                                $match: {
                                                    $expr: {
                                                        $and: [
                                                            { $eq: ["$collectionpoint_id", "$$collectionpoint_id"] }
                                                        ]
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
                                                                    $and: [
                                                                        { $eq: ["$$suburb_id", "$_id"] }
                                                                    ]
                                                                }
                                                            }
                                                        },
                                                        {
                                                            $project: {
                                                                _id: "$_id",
                                                                name: "$name",
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
                                            }
                                        ],
                                        as: 'address'
                                    }
                                },
                                {
                                    $addFields: {
                                        address: {
                                            $arrayElemAt: ["$address", 0]
                                        }
                                    }
                                },
                                {
                                    $project: {
                                        name: 1,
                                        email: 1,
                                        mobile: 1,
                                        address: 1
                                    }
                                }
                            ],
                            as: "collectionpoint"
                        }
                    },
                    {
                        $addFields: {
                            collectionpoint: {
                                $arrayElemAt: ["$collectionpoint", 0]
                            }
                        }
                    },
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
                                                { $eq: ["$_id", "$$user_id"] },
                                            ]
                                        }
                                    }
                                },
                                {
                                    $project: {
                                        _id: "$_id",
                                        name: "$name",
                                        email: "$email",
                                        mobile: "$mobile"
                                    }
                                }
                            ],
                            as: "user"
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
                                            $and: [
                                                { $eq: ["$_id", "$$product_id"] },
                                            ]
                                        }
                                    }
                                }
                            ],
                            as: "product"
                        }
                    },
                    {
                        $addFields: {
                            product: {
                                $arrayElemAt: ["$product", 0]
                            }
                        }
                    },
                    {
                        $lookup: {
                            from: "companies",
                            let: {
                                company_id: "$company_id"
                            },
                            pipeline: [
                                {
                                    $match: {
                                        $expr: {
                                            $and: [
                                                { $eq: ["$_id", "$$company_id"] },
                                            ]
                                        }
                                    }
                                }
                            ],
                            as: "company"
                        }
                    },
                    {
                        $addFields: {
                            company: {
                                $arrayElemAt: ["$company", 0]
                            }
                        }
                    },
                    {
                        $project: {
                            _id: 1,
                            booking_type: 1,
                            redeemed: 1,
                            booking_id: 1,
                            user: 1,
                            shift: 1,
                            created_at: 1,
                            scheduled_date: 1,
                            product: {
                                product_id: "$product._id",
                                name: "$product.name",
                                quantity: "$orders.quantity",
                                price: "$orders.price"
                            },
                            address: 1,
                            address_id: 1,
                            shift_id: 1,
                            delivered_time: 1,
                            collectionpoint: 1,
                            delivery_type: 1,
                            company_id: 1,
                            company: 1,
                        }
                    },
                    {
                        $group: {
                            _id: "$_id",
                            delivery_type: {
                                $first: "$delivery_type"
                            },
                            booking_type: {
                                $first: "$booking_type"
                            },
                            type: {
                                $first: "$type"
                            },
                            collectionpoint: {
                                $first: "$collectionpoint"
                            },
                            redeemed: {
                                $first: "$redeemed"
                            },
                            booking_id: {
                                $first: "$booking_id"
                            },
                            created_at: {
                                $first: "$created_at"
                            },
                            scheduled_date: {
                                $first: "$scheduled_date"
                            },
                            user: {
                                $first: "$user"
                            },
                            shift: {
                                $first: "$shift"
                            },
                            orders: {
                                $addToSet: "$product"
                            },
                            address: {
                                $first: "$address"
                            },
                            address_id: {
                                $first: "$address_id"
                            },
                            shift_id: {
                                $first: "$shift_id"
                            },
                            delivered_time: {
                                $first: "$delivered_time"
                            },
                            company_id: {
                                $first: "$company_id"
                            },
                            company: {
                                $first: "$company"
                            }
                        }
                    },
                    {
                        $sort: {
                            created_at: -1
                        }
                    }
                ],
                as: "orders"
            }
        },
        // {
        //     $match: {
        //         $expr: {
        //             $gt: [{ $size: "$orders" }, 0]
        //         }
        //     }
        // }
    ])

    if (!companies.length) {
        return res.redirect(res.locals.app_url + `/companies`);
    }

    var workbook = new Excel.Workbook();

    companies.forEach((cmp) => {
        let { name, orders } = cmp
        var worksheet = workbook.addWorksheet(`${name}`, {
            properties: { tabColor: { argb: "FFC0000" } },
        });

        worksheet.columns = [
            { header: "Booking ID", key: "booking_id", width: 35 },
            { header: "Name", key: "name", width: 35 },
            { header: "Email", key: "email", width: 35 },
            { header: "Mobile", key: "mobile", width: 35 },
            { header: "Scheduled Date", key: "scheduled_date", width: 35 },
            { header: "Shift", key: "shift", width: 35 },
            { header: "Orders", key: "orders", width: 35 },
        ];

        orders.forEach(order => {
            let { user, booking_id, scheduled_date, orders: products, shift } = order
            let { name, email, mobile } = user
            let shift_name = "";
            if (shift) {
                shift_name = shift.name
            }
            let products_string = ""
            products_string += products.map((product) => {
                let { name, quantity } = product
                return `${name} - ${quantity},`
            })

            worksheet.addRow({
                booking_id,
                name,
                email,
                mobile,
                scheduled_date: moment(scheduled_date).format('YYYY-MM-DD'),
                shift: shift_name,
                orders: products_string
            });

        });

    });

    workbook.xlsx
        .writeFile(`public/reports/cp-${req.session._id}.xlsx`)
        .then(() => {
            return res.redirect(
                res.locals.asset_url + `/public/reports/cp-${req.session._id}.xlsx`
            );
        })
        .catch((err) => {
            return res.redirect(res.locals.app_url + `/companies`);
        });
};


exports.printPdf = async (req, res) => {
    let { company: company_id } = req.query;

    let companies = await Company.aggregate([
        {
            $match: {
                delete_status: false,
                _id: ObjectId(company_id)
            }
        },
        {
            $lookup: {
                from: "bookings",
                let: {
                    company_id: "$_id"
                },
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $and: [
                                    { $eq: ['$company_id', '$$company_id'] },
                                    { $eq: ['$scheduled_date', new Date(moment().format('YYYY-MM-DD'))] }
                                ]
                            }
                        }
                    },
                    {
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
                                            $and: [
                                                { $eq: ["$$shift_id", "$shift_times._id"] },
                                            ]
                                        }
                                    }
                                },
                                {
                                    $project: {
                                        _id: "$shift_times._id",
                                        name: "$shift_times.name",
                                        duration: "$shift_times.duration",
                                        time: "$shift_times.time"
                                    }
                                }
                            ],
                            as: "shift"
                        }
                    },
                    {
                        $addFields: {
                            shift: {
                                $arrayElemAt: ["$shift", 0]
                            }
                        }
                    },
                    {
                        $lookup: {
                            from: "addresses",
                            let: {
                                address_id: "$address_id"
                            },
                            pipeline: [
                                {
                                    $match: {
                                        $expr: {
                                            $and: [
                                                { $eq: ["$_id", "$$address_id"] }
                                            ]
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
                                                        $and: [
                                                            { $eq: ["$$suburb_id", "$_id"] }
                                                        ]
                                                    }
                                                }
                                            },
                                            {
                                                $project: {
                                                    _id: "$_id",
                                                    name: "$name",
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
                                }
                            ],
                            as: 'address'
                        }
                    },
                    {
                        $addFields: {
                            address: {
                                $arrayElemAt: ["$address", 0]
                            }
                        }
                    },
                    {
                        $lookup: {
                            from: "collectionpoints",
                            let: {
                                cp_id: "$collectionpoint_id"
                            },
                            pipeline: [
                                {
                                    $match: {
                                        $expr: {
                                            $and: [
                                                { $eq: ["$$cp_id", "$_id"] }
                                            ]
                                        }
                                    }
                                },
                                {
                                    $lookup: {
                                        from: "addresses",
                                        let: {
                                            collectionpoint_id: "$_id"
                                        },
                                        pipeline: [
                                            {
                                                $match: {
                                                    $expr: {
                                                        $and: [
                                                            { $eq: ["$collectionpoint_id", "$$collectionpoint_id"] }
                                                        ]
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
                                                                    $and: [
                                                                        { $eq: ["$$suburb_id", "$_id"] }
                                                                    ]
                                                                }
                                                            }
                                                        },
                                                        {
                                                            $project: {
                                                                _id: "$_id",
                                                                name: "$name",
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
                                            }
                                        ],
                                        as: 'address'
                                    }
                                },
                                {
                                    $addFields: {
                                        address: {
                                            $arrayElemAt: ["$address", 0]
                                        }
                                    }
                                },
                                {
                                    $project: {
                                        name: 1,
                                        email: 1,
                                        mobile: 1,
                                        address: 1
                                    }
                                }
                            ],
                            as: "collectionpoint"
                        }
                    },
                    {
                        $addFields: {
                            collectionpoint: {
                                $arrayElemAt: ["$collectionpoint", 0]
                            }
                        }
                    },
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
                                                { $eq: ["$_id", "$$user_id"] },
                                            ]
                                        }
                                    }
                                },
                                {
                                    $project: {
                                        _id: "$_id",
                                        name: "$name",
                                        email: "$email",
                                        mobile: "$mobile"
                                    }
                                }
                            ],
                            as: "user"
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
                                            $and: [
                                                { $eq: ["$_id", "$$product_id"] },
                                            ]
                                        }
                                    }
                                }
                            ],
                            as: "product"
                        }
                    },
                    {
                        $addFields: {
                            product: {
                                $arrayElemAt: ["$product", 0]
                            }
                        }
                    },
                    {
                        $lookup: {
                            from: "companies",
                            let: {
                                company_id: "$company_id"
                            },
                            pipeline: [
                                {
                                    $match: {
                                        $expr: {
                                            $and: [
                                                { $eq: ["$_id", "$$company_id"] },
                                            ]
                                        }
                                    }
                                }
                            ],
                            as: "company"
                        }
                    },
                    {
                        $addFields: {
                            company: {
                                $arrayElemAt: ["$company", 0]
                            }
                        }
                    },
                    {
                        $project: {
                            _id: 1,
                            booking_type: 1,
                            redeemed: 1,
                            booking_id: 1,
                            user: 1,
                            shift: 1,
                            created_at: 1,
                            scheduled_date: 1,
                            product: {
                                product_id: "$product._id",
                                name: "$product.name",
                                quantity: "$orders.quantity",
                                price: "$orders.price"
                            },
                            address: 1,
                            address_id: 1,
                            shift_id: 1,
                            delivered_time: 1,
                            collectionpoint: 1,
                            delivery_type: 1,
                            company_id: 1,
                            company: 1,
                        }
                    },
                    {
                        $group: {
                            _id: "$_id",
                            delivery_type: {
                                $first: "$delivery_type"
                            },
                            booking_type: {
                                $first: "$booking_type"
                            },
                            type: {
                                $first: "$type"
                            },
                            collectionpoint: {
                                $first: "$collectionpoint"
                            },
                            redeemed: {
                                $first: "$redeemed"
                            },
                            booking_id: {
                                $first: "$booking_id"
                            },
                            created_at: {
                                $first: "$created_at"
                            },
                            scheduled_date: {
                                $first: "$scheduled_date"
                            },
                            user: {
                                $first: "$user"
                            },
                            shift: {
                                $first: "$shift"
                            },
                            orders: {
                                $addToSet: "$product"
                            },
                            address: {
                                $first: "$address"
                            },
                            address_id: {
                                $first: "$address_id"
                            },
                            shift_id: {
                                $first: "$shift_id"
                            },
                            delivered_time: {
                                $first: "$delivered_time"
                            },
                            company_id: {
                                $first: "$company_id"
                            },
                            company: {
                                $first: "$company"
                            }
                        }
                    },
                    {
                        $sort: {
                            created_at: -1
                        }
                    }
                ],
                as: "orders"
            }
        }
    ])

    if (!companies.length) {
        return res.redirect(res.locals.app_url + `/companies`);
    }

    let company = companies[0]

    let html = await printOrderTable(company, res.locals.app_url);
    let pdf = require("html-pdf");
    pdf.create(html).toBuffer(function (err, buffer) {
        res.writeHead(200, { 'Content-Type': 'application/pdf' });
        return res.end(buffer, 'binary')
    });
}

let printOrderTable = async (company, app_url) => {
    let { orders, name } = company;
    let orders_html = "";
    orders.map(order => {
        let { user, orders: products } = order;
        let name = user.name ? user.name : "";
        let mobile = user.mobile ? user.mobile : "";
        let products_html = ""
        products.map(product => {
            let { name, quantity } = product
            products_html += `
            <tr>
                <td>${name}</td>
                <td>${quantity}</td>
            </tr>
            `
        })
        orders_html += `
        <tr>
            <td>${name}</td>
            <td>${mobile}</td>
            <td>
                <table class="inner">
                    <tr>
                        <th>Product</th>
                        <th>Quantity</th>
                    </tr>
                    ${products_html}
                </table>
            </td>
        </tr>
        `
    })

    return `
    <!DOCTYPE html>
    <html>
    <head>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
    table {
      border-collapse: collapse;
      border-spacing: 0;
      width: 100%;
      border: 1px solid #ddd;
    }
    
    th, td {
      text-align: left;
      padding: 16px;
    }
    
    tr:nth-child(even) {
      background-color: #f2f2f2;
    }

    .inner tr{
        background-color: #ffff;
    }

    </style>
    </head>
    <body>
    
    <h2>${name}</h2>

    <table>
      <tr>
        <th>Name</th>
        <th>Mobile</th>
        <th>Orders</th>
      </tr>
      ${orders_html}
    </table>
    
    </body>
    </html>
    
    `
}



exports.pendinglist = async (req, res) => {
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
                    { email: regex },
                    { mobile: regex }
                ],
            },
        });
    }
    query.push({
        $match: {
            delete_status: {
                $ne: true,
            },
        },
    },
        {
            $lookup: {
                from: "addresses",
                let: {
                    company_id: "$_id"
                },
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $eq: ["$company_id", "$$company_id"]
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
                                    { $eq: ['$_id', "$$user_id"] }
                                ]
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
                as: "user"
            }
        },
        {
            $addFields: {
                user: {
                    $arrayElemAt: ["$user", 0]
                }
            },
        },
        {
            $sort: {
                _id: -1
            }
        }
    );

    let companies = await TmpCompany.aggregate([
        ...query,
        {
            $skip: skip,
        },
        {
            $limit: limit,
        },
    ]);

    let itemCount = await TmpCompany.aggregate([
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
        companies,
        itemCount,
        pageCount,
        pages: paginate.getArrayPages(req)(5, pageCount, page),
        activePage: page,
    };

    return res.render("admin/company/pendinglist", data);
}

exports.deleteTemp = async (req, res) => {
    let { company_id } = req.body
    if (company_id) {
        // let company = await TmpCompany.findOne({ _id: ObjectId(company_id) })
        await TmpCompany.deleteOne({ _id: ObjectId(company_id) })
        await Address.deleteOne({ company_id: ObjectId(company_id) })
    }
    return res.json({
        status: true,
        message: "Company deleted successfully"
    })
}

exports.approveCompany = async (req, res) => {
    let { company_id } = req.body
    if (company_id) {

        tmp_company = await TmpCompany.findOne({ _id: ObjectId(company_id) })
        address = await Address.findOne({ company_id: ObjectId(company_id) })
        new_company = new Company();
        let { name, email, mobile, } = tmp_company

        if (email) {
            let is_email_exists = await this.checkEmailExists(email);
            if (is_email_exists) {
                return res.json({ status: false, message: "Email already exists" });
            }
        }

        if (mobile) {
            let is_mobile_exists = await this.checkMobileExists(mobile);
            if (is_mobile_exists) {
                return res.json({ status: false, message: "Mobile already exists" });
            }
        }

        new_company.name = name;
        new_company.email = email;
        new_company.mobile = mobile;
        await new_company.save();
        address.company_id = new_company._id;
        await address.save();
        await TmpCompany.deleteOne({ _id: ObjectId(company_id) });
    }
    return res.json({
        status: true,
        message: "Company approved successfully"
    })
}