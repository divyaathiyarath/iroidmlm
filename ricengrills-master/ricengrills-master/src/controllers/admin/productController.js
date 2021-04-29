const mongoose = require('mongoose')
let ObjectId = mongoose.Types.ObjectId;
const paginate = require("express-paginate")

const Product = mongoose.model('products')

const { validateProductsInputs } = require('../../validators/productsValidator')
const productUpload = require("../../utils/uploads/productUpload");

//add vehicle
exports.new = async (req, res) => {
    return res.render('admin/products/new')
}
//add vehicle
exports.save = async (req, res) => {
    try {
        await productUpload(req, res)
    } catch (err) {
        // console.log(err)
        return res.json({ status: false, message: "Could not upload field" })
    }

    const { errors, isValid } = validateProductsInputs(req.body)
    if (!isValid) {
        return res.json({ status: false, errors })
    }

    try {
        let { name, type, price, description, is_veg, allergen_contents, container_size, ingredients, is_regular } = req.body
        let { image, cover_pic } = req.files
        if (typeof image != 'undefined' && image.length > 0) {
            image = image[0].destination + "/" + image[0].filename
        }

        if (typeof cover_pic != 'undefined' && cover_pic.length > 0) {
            cover_pic = cover_pic[0].destination + "/" + cover_pic[0].filename
        }
        
        if(is_regular == 'false'){
            is_regular = false
        }else{
            is_regular = true
        }
        product = new Product({
            name,
            price,
            description,
            type,
            image,
            cover_pic,
            container_size,
            ingredients,
            is_regular
        })
        if (type == 'FOOD') {
            var filtered = allergen_contents.filter(function (el) {
                return el != '';
            });
            product.is_veg = is_veg
            product.allergen_contents = filtered
        }
        await product.save()
        return res.json({
            status: true,
            message: "Product saved successfully"
        })

    } catch (err) {
        console.log(err)
        return res.json({
            status: false,
            message: "Could not add Product"
        })
    }

}
//list vehicles
exports.list = async (req, res) => {
    let { search, page, limit, type } = req.query
    if (typeof type === "undefined") {
        type = 'food'
    }
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
                    { description: regex },
                ]
            }
        })
    }
    // if(type) {
    //     query.push({
    //         $match: {
    //         }
    //     })
    // }
    query.push({
        $match: {
            type: type.toUpperCase(),
            delete_status: {
                $ne: true
            }
        }
    })

    let products = await Product.aggregate([...query, {
        $skip: skip
    }, {
        $limit: limit
    }])

    let itemCount = await Product.aggregate([...query, {
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
        type,
        products,
        itemCount,
        pageCount,
        pages: paginate.getArrayPages(req)(5, pageCount, page),
        activePage: page,
    }
    return res.render('admin/products/list', data)
}

exports.checkVehicleExists = async (registration_number) => {
    vehicle = await Vehicle.findOne({ registrtation_number, delete_status: false }).countDocuments();
    return vehicle
}

exports.delete = async (req, res) => {
    const { product } = req.body
    await Product.updateOne({
        _id: ObjectId(product)
    }, {
        $set: {
            delete_status: true,
            deleted_at: Date.now()
        }
    })
    return res.json({
        status: true,
        message: "Product deleted successfully"
    })
}

//add vehicle
exports.edit = async (req, res) => {
    let { product_id } = req.params;
    let product = await Product.findOne({ _id: ObjectId(product_id) })
    if (!product) {
        res.redirect(res.locals.app_url + "/products/new")
    }
    return res.render('admin/products/edit', { product })
}

//update product
exports.update = async (req, res) => {
    try {
        await productUpload(req, res)
    } catch (err) {
        // console.log(err)
        return res.json({ status: false, message: "Could not upload file" })
    }

    const { errors, isValid } = validateProductsInputs(req.body)
    if (!isValid) {
        return res.json({ status: false, errors })
    }

    try {
        let { name, type, price, description, product_id, is_veg, allergen_contents, container_size, ingredients, is_regular } = req.body
        let { image, cover_pic } = req.files

        if (typeof image != 'undefined' && image.length > 0) {
            image = image[0].destination + "/" + image[0].filename
        }

        if (typeof cover_pic != 'undefined' && cover_pic.length > 0) {
            cover_pic = cover_pic[0].destination + "/" + cover_pic[0].filename
        }

        if(is_regular == 'false'){
            is_regular = false
        }else{
            is_regular = true
        }

      


        product = await Product.findOne({ _id: ObjectId(product_id) })

        product.name = name;
        product.price = price;
        product.description = description;
        product.container_size = container_size;
        product.ingredients = ingredients;
        product.type = type;
        product.is_regular = is_regular;
        if (image) {
            product.image = image
        }
        if (cover_pic) {
            product.cover_pic = cover_pic
        }
        if (type == 'FOOD') {
            var filtered = allergen_contents.filter(function (el) {
                return el != '';
            });
            product.is_veg = is_veg
            product.allergen_contents = filtered
        }
        await product.save()
        return res.json({
            status: true,
            message: "Product updated successfully"
        })

    } catch (err) {
        console.log(err)
        return res.json({
            status: false,
            message: "Could not update Product"
        })
    }

}