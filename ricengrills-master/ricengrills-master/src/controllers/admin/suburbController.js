const mongoose = require('mongoose')
let ObjectId = mongoose.Types.ObjectId
const paginate = require("express-paginate")
const Suburb = mongoose.model('suburbs')
let { validateSuburbsInputs } = require('../../validators/suburbsValidator')
let { getComingShift} = require('./stockController')

exports.new = async(req, res) => {
    return res.render('admin/suburbs/new')
}

exports.save = async(req, res) => {
    const { errors, isValid } = validateSuburbsInputs(req.body)
    if (!isValid) {
        return res.json({ status: false, errors })
    }

    try {
        let { name, address, radius, lat, lng } = req.body

        suburb = await new Suburb()
        suburb.name = name;
        suburb.address = address;
        suburb.radius = radius;
        suburb.location = {
            type: "Point",
            coordinates: [
                lng, lat
            ]
        };
        await suburb.save()

        return res.json({
            status: true,
            message: "Suburb added successfully"
        })

    } catch (err) {
        console.log(err)
        return res.json({
            status: false,
            message: "Could not save Suburb"
        })
    }
}


exports.list = async(req, res) => {
    let { shifts } = await getComingShift();
    let { search, page, limit } = req.query
    if (typeof limit == 'undefined') {
        limit = 10
    }
    if (typeof page == 'undefined') {
        page = 1
    }
    let skip = 0
    if (page > 1) {
        skip = (page - 1) * limit
    }
    let query = [];
    if (search) {
        let regex = { $regex: new RegExp(".*" + search.trim() + ".*", "i") };
        query.push({
            $match: {
                $or: [
                    { name: regex },
                ]
            }
        })
    }
    query.push({
        $match: {
            delete_status: {
                $ne: true
            }
        }
    })

    let suburbs = await Suburb.aggregate([...query, {
        $skip: skip
    }, {
        $limit: limit
    }])

    let itemCount = await Suburb.aggregate([...query, {
        $count: "count"
    }])

    if (itemCount.length > 0) {
        itemCount = itemCount[0].count
    } else {
        itemCount = 0
    }

    const pageCount = Math.ceil(itemCount / limit);

    let data = {
        search,
        suburbs,
        itemCount,
        pageCount,
        pages: paginate.getArrayPages(req)(5, pageCount, page),
        activePage: page,
        shifts
    }
    return res.render('admin/suburbs/list', data);
}

exports.addSuburb = async(req, res) => {
    //Dandenong North and Noble Park North
    let array = [{
            name: "Dandenong North",
            location: {
                "type": "Polygon",
                "coordinates": [
                    [
                        [145.19493, -37.93796],
                        [145.19871, -37.94097],
                        [145.19649, -37.95289],
                        [145.19672, -37.95313],
                        [145.1963192, -37.9551634],
                        [145.1963167, -37.9552212],
                        [145.1963763, -37.9552182],
                        [145.2024467, -37.9559674],
                        [145.20263, -37.95599],
                        [145.20183, -37.95763],
                        [145.20064, -37.95944],
                        [145.19628, -37.96474],
                        [145.19567, -37.96585],
                        [145.19508, -37.96754],
                        [145.19637, -37.96781],
                        [145.199232, -37.9681551],
                        [145.21221, -37.96972],
                        [145.23428, -37.97227],
                        [145.23404, -37.97162],
                        [145.23325, -37.97101],
                        [145.23293, -37.97002],
                        [145.23311, -37.96887],
                        [145.23295, -37.96757],
                        [145.23329, -37.96608],
                        [145.23358, -37.96436],
                        [145.23327, -37.96293],
                        [145.23279, -37.96258],
                        [145.23289, -37.96207],
                        [145.2325, -37.96164],
                        [145.23239, -37.96103],
                        [145.23286, -37.96094],
                        [145.23308, -37.96038],
                        [145.23357, -37.96028],
                        [145.23372, -37.95992],
                        [145.23361, -37.95932],
                        [145.23398, -37.95869],
                        [145.23358, -37.95851],
                        [145.23358, -37.95829],
                        [145.23388, -37.95781],
                        [145.23385, -37.95728],
                        [145.23408, -37.95671],
                        [145.23357, -37.95564],
                        [145.23359, -37.9548],
                        [145.23304, -37.95358],
                        [145.23223, -37.95254],
                        [145.23182, -37.95251],
                        [145.23153, -37.95276],
                        [145.23028, -37.95262],
                        [145.22964, -37.95234],
                        [145.22615, -37.95014],
                        [145.22633, -37.94983],
                        [145.22653, -37.94817],
                        [145.22499, -37.94617],
                        [145.2238, -37.9452],
                        [145.22275, -37.94318],
                        [145.22215, -37.9425],
                        [145.22144, -37.94186],
                        [145.22028, -37.94151],
                        [145.22003, -37.94123],
                        [145.21998, -37.94089],
                        [145.21908, -37.94077],
                        [145.21966, -37.94026],
                        [145.21919, -37.94015],
                        [145.2180067, -37.9400096],
                        [145.21068, -37.93914],
                        [145.2071033, -37.9388328],
                        [145.2065671, -37.9387868],
                        [145.196847, -37.9379521],
                        [145.1968149, -37.9379493],
                        [145.19496, -37.93779],
                        [145.19493, -37.93796]
                    ]
                ]
            }
        },
        {
            name: "Noble Park North",
            location: {
                "type": "Polygon",
                "coordinates": [
                    [
                        [145.176, -37.95053],
                        [145.1884804, -37.9616279],
                        [145.19508, -37.96754],
                        [145.19567, -37.96585],
                        [145.19628, -37.96474],
                        [145.20064, -37.95944],
                        [145.20183, -37.95763],
                        [145.20263, -37.95599],
                        [145.2024467, -37.9559674],
                        [145.1963763, -37.9552182],
                        [145.1963167, -37.9552212],
                        [145.1963192, -37.9551634],
                        [145.19672, -37.95313],
                        [145.19649, -37.95289],
                        [145.19871, -37.94097],
                        [145.19493, -37.93796],
                        [145.19496, -37.93779],
                        [145.19249, -37.9376],
                        [145.18344, -37.9365],
                        [145.1831, -37.93832],
                        [145.18481, -37.93855],
                        [145.1858, -37.93899],
                        [145.18657, -37.93953],
                        [145.18706, -37.94025],
                        [145.18723, -37.94135],
                        [145.18656, -37.94449],
                        [145.18591, -37.94554],
                        [145.18495, -37.94617],
                        [145.18312, -37.94664],
                        [145.18155, -37.94644],
                        [145.18072, -37.95098],
                        [145.1770409, -37.9506292],
                        [145.1763676, -37.9505565],
                        [145.176, -37.95053]
                    ]
                ]
            }
        },
        {
            name: "Dandenong",
            location: {
                "type": "Polygon",
                "coordinates": [
                    [
                        [145.1921, -37.99481],
                        [145.19228, -37.99532],
                        [145.19271, -37.99605],
                        [145.19468, -37.99812],
                        [145.19469, -37.99836],
                        [145.19421, -37.99917],
                        [145.1932591, -38.001468],
                        [145.1996431, -38.0022663],
                        [145.2001947, -38.0023376],
                        [145.2005283, -38.0023788],
                        [145.2008861, -38.0024198],
                        [145.2012399, -38.0024569],
                        [145.2015474, -38.0024862],
                        [145.2018573, -38.0025119],
                        [145.2022502, -38.0025399],
                        [145.2025432, -38.002557],
                        [145.2028456, -38.0025724],
                        [145.2033207, -38.0025929],
                        [145.203747, -38.0026143],
                        [145.2051979, -38.0027285],
                        [145.2077834, -38.0029957],
                        [145.2079858, -38.0030166],
                        [145.2090769, -38.00314],
                        [145.2126015, -38.0035854],
                        [145.2127055, -38.0030712],
                        [145.2134465, -37.9994036],
                        [145.213457, -37.9993367],
                        [145.2134689, -37.9992929],
                        [145.2182398, -37.9999024],
                        [145.2185552, -37.998262],
                        [145.218696, -37.998358],
                        [145.2189719, -37.9985379],
                        [145.2192428, -37.998699],
                        [145.2198281, -37.9989992],
                        [145.2206947, -37.9993959],
                        [145.2216655, -37.9998293],
                        [145.2220897, -38.0000226],
                        [145.22323, -38.00054],
                        [145.2260162, -38.0018039],
                        [145.22538, -38.00053],
                        [145.22733, -38.00074],
                        [145.22865, -37.99377],
                        [145.22653, -37.99347],
                        [145.22684, -37.99329],
                        [145.22726, -37.99265],
                        [145.22733, -37.99102],
                        [145.22769, -37.99026],
                        [145.22809, -37.9902],
                        [145.22843, -37.9898],
                        [145.22902, -37.98974],
                        [145.22936, -37.98951],
                        [145.22949, -37.98857],
                        [145.2301, -37.9886],
                        [145.23, -37.98819],
                        [145.23018, -37.98675],
                        [145.23053, -37.9867],
                        [145.23076, -37.98569],
                        [145.23115, -37.98541],
                        [145.2319, -37.98552],
                        [145.23194, -37.98506],
                        [145.23176, -37.98471],
                        [145.23222, -37.98432],
                        [145.23226, -37.98386],
                        [145.23175, -37.98383],
                        [145.23168, -37.98367],
                        [145.23243, -37.98303],
                        [145.23225, -37.98227],
                        [145.2325, -37.98197],
                        [145.23186, -37.98099],
                        [145.23196, -37.98082],
                        [145.23254, -37.98081],
                        [145.23316, -37.98058],
                        [145.23285, -37.9804],
                        [145.23245, -37.98054],
                        [145.23263, -37.9802],
                        [145.23299, -37.97999],
                        [145.23285, -37.97953],
                        [145.23327, -37.97961],
                        [145.23366, -37.97942],
                        [145.23405, -37.97955],
                        [145.23419, -37.97946],
                        [145.23415, -37.97854],
                        [145.23427, -37.9784],
                        [145.23481, -37.97844],
                        [145.23495, -37.9783],
                        [145.23456, -37.97797],
                        [145.23497, -37.97758],
                        [145.23485, -37.97743],
                        [145.23499, -37.97705],
                        [145.23506, -37.97674],
                        [145.23546, -37.97671],
                        [145.23512, -37.97628],
                        [145.2353, -37.97616],
                        [145.23542, -37.9745],
                        [145.2357, -37.97425],
                        [145.23535, -37.97382],
                        [145.23495, -37.97365],
                        [145.23477, -37.97292],
                        [145.23428, -37.97227],
                        [145.21221, -37.96972],
                        [145.199232, -37.9681551],
                        [145.19637, -37.96781],
                        [145.19508, -37.96754],
                        [145.19318, -37.97798],
                        [145.19372, -37.97803],
                        [145.19486, -37.97882],
                        [145.19499, -37.97859],
                        [145.19644, -37.97877],
                        [145.19624, -37.97978],
                        [145.19694, -37.98042],
                        [145.19671, -37.98063],
                        [145.19684, -37.98072],
                        [145.19625, -37.98128],
                        [145.19652, -37.98146],
                        [145.19543, -37.98162],
                        [145.19475, -37.98208],
                        [145.1947, -37.98228],
                        [145.19404, -37.98258],
                        [145.19408, -37.98321],
                        [145.19406, -37.9835],
                        [145.19366, -37.98442],
                        [145.19266, -37.9899],
                        [145.19213, -37.99425],
                        [145.1921, -37.99481]
                    ]
                ]
            }
        },
        {
            name: "Keysborough",
            location: {
                "type": "Polygon",
                "coordinates": [
                    [
                        [145.13732, -38.02132],
                        [145.16394, -38.02852],
                        [145.17838, -38.0328],
                        [145.18092, -38.03284],
                        [145.1821, -38.0327],
                        [145.1835, -38.03182],
                        [145.1845, -38.03076],
                        [145.18666, -38.02339],
                        [145.18728, -38.02196],
                        [145.1874055, -38.0215545],
                        [145.1876503, -38.0207634],
                        [145.19056, -38.01136],
                        [145.19205, -38.00439],
                        [145.1932591, -38.001468],
                        [145.19421, -37.99917],
                        [145.19469, -37.99836],
                        [145.19468, -37.99812],
                        [145.19271, -37.99605],
                        [145.19228, -37.99532],
                        [145.1921, -37.99481],
                        [145.19213, -37.99425],
                        [145.19266, -37.9899],
                        [145.19366, -37.98442],
                        [145.19406, -37.9835],
                        [145.19408, -37.98321],
                        [145.1930047, -37.9830801],
                        [145.19259, -37.98303],
                        [145.19208, -37.98037],
                        [145.19185, -37.98021],
                        [145.19156, -37.98168],
                        [145.19074, -37.98158],
                        [145.19059, -37.98237],
                        [145.1863204, -37.9819145],
                        [145.1859362, -37.9818735],
                        [145.18581, -37.98186],
                        [145.18567, -37.98226],
                        [145.18528, -37.98222],
                        [145.18534, -37.98187],
                        [145.18432, -37.98183],
                        [145.18407, -37.98313],
                        [145.18358, -37.98307],
                        [145.18338, -37.98408],
                        [145.18303, -37.98404],
                        [145.18296, -37.98444],
                        [145.18225, -37.98436],
                        [145.1823, -37.98404],
                        [145.17968, -37.98367],
                        [145.17955, -37.98403],
                        [145.1767, -37.98368],
                        [145.1768163, -37.9832279],
                        [145.17628, -37.98316],
                        [145.17607, -37.98425],
                        [145.1747, -37.98408],
                        [145.17453, -37.98426],
                        [145.17034, -37.9837],
                        [145.17062, -37.98224],
                        [145.17054, -37.98199],
                        [145.16875, -37.98295],
                        [145.16628, -37.98028],
                        [145.16547, -37.98011],
                        [145.16549, -37.97997],
                        [145.16501, -37.97991],
                        [145.16478, -37.98107],
                        [145.164263, -37.9811814],
                        [145.1642591, -37.9812294],
                        [145.1629092, -37.9810709],
                        [145.1627879, -37.981187],
                        [145.1622771, -37.9811102],
                        [145.1622514, -37.9812181],
                        [145.1619432, -37.9811882],
                        [145.16177, -37.98156],
                        [145.15859, -37.98117],
                        [145.15601, -37.98087],
                        [145.1559752, -37.9810485],
                        [145.15547, -37.98364],
                        [145.15182, -37.98328],
                        [145.15169, -37.98308],
                        [145.15116, -37.98318],
                        [145.1479924, -37.9827828],
                        [145.14797, -37.98278],
                        [145.14766, -37.98228],
                        [145.14624, -37.98211],
                        [145.14591, -37.98361],
                        [145.1446968, -37.9908603],
                        [145.14083, -38.01074],
                        [145.1393, -38.01878],
                        [145.13862, -38.01997],
                        [145.13732, -38.02132]
                    ]
                ]
            }
        },
        {
            name: "",
            location: {}
        },
        {
            name: "",
            location: {}
        },
        {
            name: "",
            location: {}
        }

    ]

}


exports.delete = async(req, res) => {
    const { suburb } = req.body
    await Suburb.updateOne({
        _id: ObjectId(suburb)
    }, {
        $set: {
            delete_status: true,
            deleted_at: new Date()
        }
    })
    return res.json({
        status: true,
        message: "Suburb deleted successfully"
    })
}

exports.edit = async(req, res) => {
    let { suburb_id } = req.params;
    let suburb = await Suburb.findOne({ _id: ObjectId(suburb_id) })
    if (!suburb) {
        res.redirect(res.locals.app_url + "/suburbs/new")
    }
    return res.render('admin/suburbs/edit', { suburb })
}

exports.update = async(req, res) => {

    const { errors, isValid } = validateSuburbsInputs(req.body)
    if (!isValid) {
        return res.json({ status: false, errors })
    }

    try {
        let { _id, name, address, radius, lat, lng } = req.body

        suburb = await Suburb.findOne({ _id: ObjectId(_id) })

        suburb.name = name;
        suburb.address = address;
        suburb.radius = radius;
        suburb.location = {
            type: "Point",
            coordinates: [
                lng, lat
            ]
        };
        await suburb.save()
        return res.json({
            status: true,
            message: "Suburb updated successfully"
        })

    } catch (err) {
        console.log(err)
        return res.json({
            status: false,
            message: "Could not update Suburb"
        })
    }
}

exports.one = async(req, res) => {
    let { suburb } = req.query
    suburb = await Suburb.findOne({ _id: ObjectId(suburb) })
    if (!suburb) {
        return res.json({
            status: false,
            message: "No such suburb found"
        })
    }
    return res.json({
        status: true,
        data: {
            suburb
        }
    })
}

exports.setRealTimeDelivery = async(req,res) => {
    let {approve, id:suburb_id} = req.body
    console.log(req.body)
    let suburb = await Suburb.findOne({_id: ObjectId(suburb_id)})
    if(suburb){
        let active = false
        if(approve == 1){
            active = true
        }
        suburb.has_realtime_order = active
        await suburb.save()
    }
    return res.json({
        status: true
    })
}

exports.setrealtimeonlinedelivery = async(req, res) => {
    let {approve, id:suburb_id, shift_id} = req.body
    console.log(req.body)
    let suburb = await Suburb.findOne({_id: ObjectId(suburb_id)})
    if(suburb){
        if(approve == 1){
            await Suburb.updateOne(
                { _id: ObjectId(suburb_id) },
                { $addToSet: { has_online_delivery: ObjectId(shift_id) } }
            )
        }else{
            await Suburb.updateOne(
                { _id: ObjectId(suburb_id) },
                { $pull: { has_online_delivery: ObjectId(shift_id) } }
            )
        }
    }
    return res.json({
        status: true
    })
}