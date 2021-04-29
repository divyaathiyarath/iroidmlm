const mongoose = require('mongoose')
const ObjectId = mongoose.Types.ObjectId
const moment = require("moment")

let { getComingShift } = require('../controllers/admin/stockController');

const Stock = mongoose.model('stocks')
const Address = mongoose.model('addresses')

exports.checkStockLimit = async(products, quantities, delivery_type, address_id, collectionpoint_id) => {
    
    let { shifts, coming_shift } = await getComingShift();
    let coming_products = []
    for(var i = 0; i < products.length; i++) {
        let obj = {
            product_id: ObjectId(products[i]),
            quantity: parseInt(quantities[i])
        }
        coming_products.push(obj)
    }
    if(delivery_type == 'ONLINE') {
        let address_details = await Address.findOne({
            _id: address_id
        })
        let stocks = await Stock.aggregate([
            {
                $match: {
                    suburb_id: ObjectId(address_details.suburb_id),
                    shift_id: ObjectId(coming_shift),
                    date: new Date(moment().format('YYYY-MM-DD')),
                    type: 'DELIVERY'
                }
            },
            {
                $project: {
                    products: 1,
                    driver_id: 1,
                }
            },
            {
                $addFields: {
                    coming_products,
                }
            },
            {
                $addFields: {
                    common: {
                        $filter: {
                            input: "$coming_products",
                            as: "coming_product",
                            cond: {
                                $anyElementTrue: {
                                    $map: {
                                        input: "$products",
                                        as: 'product',
                                        in: {
                                            $and: [
                                                {
                                                    $eq: ["$$product.product_id", "$$coming_product.product_id"]
                                                },
                                                {
                                                    $gte: ["$$product.stock", "$$coming_product.quantity"]
                                                }
                                            ]
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        ])
        return {                                            
            stocks
        }
    }
}