function applyVoucher() {
    $('#coupon').val('')
    $('#discount').val('')
    var voucher = $('#apply_voucher').val()
    if (voucher) {
        $.ajax({
            url: `${APP_URL}/getcoupon`,
            data: {
                voucher,
                address_id: delivery_address_id
            },
            type: "GET",
            dataType: "json",
            success: function (data) {
                var {
                    status,
                    coupon
                } = data;
                if (coupon) {
                    toastr["success"]('Voucher Applied');
                    $('#coupon').val(coupon.code)
                    $('#discount').val(coupon.val)
                } else {
                    toastr["error"]('Voucher is invalid or not available in your region');
                }
                renderPricing()
            }
        });
    }
    return false
}

function changeAddress() {
    $.ajax({
        url: `${APP_URL}/setaddress`,
        data: {
            address_id: delivery_address_id
        },
        type: "GET",
        dataType: "json",
        success: function (data) {
            var {
                status
            } = data;
            if (status) {
                console.log('Address changed')
            }
        }
    });
}

function chooseUserAddress(el) {
    $('#addresses-modal').modal('toggle')
}

function changeDeliveryType(type) {
    $('#delivery-panel').html('');
    var html = ''
    if (type == "express") {
        html += `
            <div class="shop_card express">
                <img src="${APP_URL}/public/web/images/delivery_vehicle.svg" alt="">
                <div class="shop_details">
                    <h3> Delivery </h3>
                    <p class="blackt">
                        You have opted for your order to be delivered. 
                        Per item delivery charge is applicable. 
                        Please select your desired address from your list of addresses. 
                        Your order will be delivered to your preferred address once your order is confirmed.
                    </p>
                </div>
            </div>
        `
    } else {
        html += `
            <div class="shop_card shop" hidden>
                <img src="${APP_URL}/public/web/images/shop-icon.svg" alt="">
                <div class="shop_details">
                    <h3> Collection Point </h3>
                    <p class="blackt"> 
                        You have opted to pickup your order from one of our Collection Points. 
                        Please select a pickup point from either the map shown above or from the Collection Points listed below. 
                        You can collect your order from your desired pickup point once your order is confirmed.
                    </p>                    
                </div>
            </div>
        `
    }
    $('#delivery-panel').html(html);
    $('select[name="delivery_address_id"]').val(delivery_address_id)
    $('select[name="delivery_address_id"]').select2('destroy');
    $('select[name="delivery_address_id"]').select2();
}

function renderStock(stocks){
    var products_html = "";
    stocks.forEach(stock=>{
        let { name , stock:count} = stock
        products_html += `
            <tr>
                <td>${name}</td>
                <td>${count}</td>
            </tr>
        `
    })
    var html = `
        <table class="table table-striped" style="border: solid thin lightgrey;">
            <tr>
                <th>Product</th>
                <th>Stock</th>
            </tr>
            ${products_html}
        </table>
    `
    $('#suburb_stock').html(html)
}

function renderAddress() {
    var address = $('#delivery_address_id').val()
    $.ajax({
        url: `${APP_URL}/addressdetails_realtime`,
        data: {
            address_id: delivery_address_id
        },
        type: "GET",
        dataType: "json",
        success: function (data) {
            var {
                status,
                address,
                stock,
                has_expres_delivery
            } = data;
            var html = ''
            if (address) {
                var { _id, name, type, address_line1, address_line2, address_type, appartment, contact_person, house_flat_no, landmark, to_reach } = address                
                
                if (type == "USER") {
                    delivery_type = "express"
                    if (address_type) {
                        html += `<u> ${address_type} </u>`
                    }
                    if (address_line1) {
                        html += `<p> ${address_line1}</p>`
                    }
                    if (house_flat_no) {
                        html += `<p> Unit: ${house_flat_no}</p>`
                    }
                    if (appartment) {
                        html += `<p> Street number: ${appartment}</p>`
                    }
                    if (landmark) {
                        html += `<p> Street name : ${landmark}</p>`
                    }
                    if (to_reach) {
                        html += `<p> Instructions reach location : ${to_reach}</p>`
                    }
                    $("#delivery_check").prop("checked", true);
                    $('.delivery_address_sec').show()
                    $('.pickup_address_sec').hide()  
                    $('.google_map_fluid').fadeOut('slow')
                    // $('input[name="delivery_type"]').trigger('change')
                } else {
                    delivery_type = "shop"
                    if (address_type) {
                        html += `<u>Collection Point</u>`
                    }
                    if (name) {
                        html += `<p><b>${name}</b></p>`
                    }
                    if (address_line1) {
                        html += `<p> ${address_line1}</p>`
                    }
                    if (house_flat_no) {
                        html += `<p> Unit: ${house_flat_no}</p>`
                    }
                    if (appartment) {
                        html += `<p> Street number: ${appartment}</p>`
                    }
                    if (landmark) {
                        html += `<p> Street name  : ${landmark}</p>`
                    }
                    if (to_reach) {
                        html += `<p> Instructions reach location : ${to_reach}</p>`
                    }
                    $("#pickup_check").prop("checked", true);
                    $('.pickup_address_sec').show()
                    $('.delivery_address_sec').hide()
                    $('.google_map_fluid').fadeIn('slow')
                    // $('input[name="delivery_type"]').trigger('change')
                }
            }

            if(address){
                if(!has_expres_delivery){
                    $('#suburb_stock').html("<div class='alert alert-danger'>No delivery service in selected suburb</div>")
                }else{
                    if(stock && stock.length > 0){
                        renderStock(stock)
                    }else{
                        if(delivery_type == "shop"){
                            $('#suburb_stock').html("<div class='alert alert-danger'>Collection point is not active</div>")
                        }else{
                            $('#suburb_stock').html("<div class='alert alert-danger'>No stock available in your selected suburb</div>")
                        }
                    }
                }
            }else{
                $('#suburb_stock').html("")
            }            

            changeDeliveryType(delivery_type)
            renderPricing()
            $('#activeAddressCard').html(html)
            applyVoucher()
        }
    });
    return false
}
renderAddress()



var options = {
    page: 6,
    valueNames: [
        { name: 'image', attr: 'src' },
        'name',
        'price',
        { name: 'data-price', attr: 'data-price' },
        { name: 'count', attr: 'value' },
        { name: 'product_id', selector: '.product_id', attr: 'data-product' },
    ],
    item: `<div class="col-lg-4 col-sm-6 col-6">
        <div class="card item_card box_view wow animate__bounceIn mb-5" data-wow-delay="1.1s">
            <div class="item_cover">
                <img src="" alt="" class="image">
            </div>
            <h4 class="name"></h4>
            <div class="product_quantity">
                <div class="inner">
                    <div class="quantity-selectors">
                        <button type="button" class="decrement-quantity" aria-label="Subtract one"
                            data-direction="-1" onclick="changeQuantities(this)">
                            <svg class="icon">
                                <use xlink:href="#minus"></use>
                            </svg></button>
                        <button type="button" class="increment-quantity" aria-label="Add one"
                            data-direction="1" onclick="changeQuantities(this)"> <svg class="icon">
                                <use xlink:href="#plus"></use>
                            </svg></button>
                    </div>
                    <input data-cart="true" data-min="1" data-max="0" type="text" name="count[]" value="0" readonly="true" class="count data-price" data-price>
                    <div class="quantity-selectors-container"> </div>
                </div>
            </div>
            <h3>$<span class="price"></span></h3>
            <div class="btn link product_id" onclick="removeFromCart(this)" data-product> <u> Remove </u></div>
        </div>
    </div>`
};

var products_list = new List('products_list', options);


var options2 = {
    valueNames: [
        { name: 'image', attr: 'src' },
        'name',
        'price',
        { name: 'data-price', attr: 'data-price' },
        { name: 'count', attr: 'value' },
        { name: 'product_id', selector: '.product_id', attr: 'data-product' },
    ],
    item: `<div class="col-lg-4 col-sm-6 col-6">
        <div class="card item_card box_view wow animate__bounceIn mb-5" data-wow-delay="1.1s">
            <div class="item_cover">
                <img src="" alt="" class="image">
            </div>
            <h4 class="name"></h4>
            <div class="product_quantity">
                <div class="inner">
                    <div class="quantity-selectors">
                        <button type="button" class="decrement-quantity" aria-label="Subtract one"
                            data-direction="-1" onclick="changeQuantities(this)">
                            <svg class="icon">
                                <use xlink:href="#minus"></use>
                            </svg></button>
                        <button type="button" class="increment-quantity" aria-label="Add one"
                            data-direction="1" onclick="changeQuantities(this)"> <svg class="icon">
                                <use xlink:href="#plus"></use>
                            </svg></button>
                    </div>
                    <input data-accessory="true" data-min="0" data-max="0" type="text" name="count[]" value="0" readonly="true" class="count acc-count data-price" data-price>
                    <div class="quantity-selectors-container"> </div>
                </div>
            </div>
            <h3>$<span class="price"></span></h3>
        </div>
    </div>`
};
var accessories_list = new List('accessories_list', options2);

function removeFromCart(el) {
    var product_id = $(el).data('product')
    $.ajax({
        url: `${APP_URL}/removefromcart`,
        data: {
            product: product_id
        },
        type: "GET",
        dataType: "json",
        success: function (data) {
            var {
                status
            } = data;
            if (status) {
                products_list.remove("product_id", product_id);
                renderPricing()
            }
        }
    });
}

function addproductstocart(products, accessories) {
    $.ajax({
        url: `${APP_URL}/addproductstocart`,
        data: {
            products,
            accessories,
            delivery_address_id
        },
        type: "POST",
        dataType: "json",
        success: function (data) {
            console.log("added")
        }
    });
    return false
}

function renderPricing() {
    items = products_list.get()
    accessories = accessories_list.get()
    var discount = $('#discount').val()
    var products = []
    var itemtotal = 0
    var tax = 0
    var discount_price = 0
    var total = 0
    var total_items = 0
    var del_charge = 0
    var first_order = 0
    var pay_from_credit = 0
    var credit_used = 0
    if ($('input[name="pay_credit"]').is(':checked')) {
        pay_from_credit = 1
    }

    if (items.length) {
        var i = 0
        var products = []
        $.each(items, function (key, item) {
            ++i
            var values = item.values()
            var {
                product_id,
                'data-price': price
            } = values
            if (i == 1) {
                if (first_order_status == "true" && delivery_type == "express") {
                    first_order = +price
                    first_order += +delivery_charge
                }
            }
            var count = $(`.count:eq(${key})`).val()
            if (count && count > 0) {
                total_items = +total_items + +count
                itemtotal += (+price * +count)
            }
            products.push({
                product_id,
                count
            })
        })


        if (delivery_type == 'express') {
            del_charge = +total_items * +delivery_charge
        }

        var accessories_lists = []
        $.each(accessories, function (key, item) {
            var values = item.values()
            var {
                'data-price': price,
                product_id
            } = values
            var count = $(`.acc-count:eq(${key})`).val()
            if (count && count > 0) {
                itemtotal += (+price * +count)
                accessories_lists.push({
                    product_id,
                    count
                })
            }
        })

        addproductstocart(products, accessories_lists)

        // tax = (itemtotal  * (+gst / +100))
        total = (+itemtotal + +del_charge - +first_order)

        discount_price = (total * (+discount / +100))

        total = total - discount_price

        if (pay_from_credit && food_credits > total) {
            credit_used = total
            total = 0
        } else if (pay_from_credit && +food_credits < +total) {
            credit_used = food_credits
            total = +total - +food_credits
        }


    }

    first_order_html = ""
    if (first_order) {
        first_order_html += `
<li>
<div class="text-success"> First order Discount </div>
<div class="text-danger"> $${parseFloat(first_order).toFixed(2)}</div>
</li>
`
    }

    credit_used_html = ""
    if (pay_from_credit && food_credits > 0) {
        credit_used_html += `
<li>
<div class="text-success"> Credit Used </div>
<div class="text-danger"> $${parseFloat(credit_used).toFixed(2)}</div>
</li>
`
    }

    var payment_service_charge = ""
    var service_charge = 0
    if (service_charge_square && selected_service_val == "square") {
        service_charge = +total * (+service_charge_square / 100)
        total = total + service_charge
        payment_service_charge += `
            <li>
                <div> Service charge </div>
                <div> $${service_charge.toFixed(2)}</div>
            </li>
        `
    }else if(service_charge_paypal && selected_service_val == "paypal"){
        service_charge = +total * (+service_charge_paypal / 100)
        total = total + service_charge
        payment_service_charge += `
            <li>
                <div> Service charge </div>
                <div> $${service_charge.toFixed(2)}</div>
            </li>
        `
    }

    var pricingHtml = `        
<ul>
<li>
<div> Item Total </div>
<div><span> $${itemtotal.toFixed(2)}</span></div>
</li>
<li>
<div> Delivery Charges </div>
<div> $${del_charge.toFixed(2)}</div>
</li>
${payment_service_charge}
<li class="hr"> </li>
${first_order_html}
<li>
<div> Voucher Discount </div>
<div> $${discount_price.toFixed(2)}</div>
</li>
${credit_used_html}
<li class="total">
<div> Total to pay (Incl. GST) </div>
<div> $${total.toFixed(2)}</div>
</li>
</ul>
`
    $('.payment_details_con').html(pricingHtml)
}

function renderAccessories() {
    $.ajax({
        url: `${APP_URL}/cartaccessories`,
        data: {
        },
        type: "GET",
        dataType: "json",
        success: function (data) {
            var {
                status,
                products
            } = data;
            if (products.length > 0) {
                $.each(products, function (key, product) {
                    var { _id, name, image, product, count, price } = product
                    console.log({ name, image, product, count, price })
                    var current_price = +price
                    if (count) {
                        +current_price * +count
                    }
                    accessories_list.add({
                        image: ASSET_URL + "/" + image,
                        name,
                        price: (current_price).toFixed(2),
                        'data-price': (+price).toFixed(2),
                        count: count,
                        product_id: _id,
                    })
                })
            } else {
                $('.acccessories_heading').html('')
            }
            renderPricing()
        }
    });
    return false
}

function renderCartProducts() {
    $.ajax({
        url: `${APP_URL}/cartregularproducts`,
        data: {
        },
        type: "GET",
        dataType: "json",
        success: function (data) {
            var {
                status,
                products
            } = data;
            if (products.length > 0) {
                $.each(products, function (key, product) {
                    products_list.add({
                        image: ASSET_URL + "/" + product.image,
                        name: product.name,
                        price: (product.price * product.count).toFixed(2),
                        'data-price': product.price.toFixed(2),
                        count: product.count,
                        product_id: product._id,
                    })
                })
                renderAccessories()
            }

        }
    });
    return false
}
renderCartProducts()

function initMap() {
    map = new google.maps.Map(document.getElementById('map'), {
        zoom: 16,
        center: initloc,
        mapTypeId: google.maps.MapTypeId.ROADMAP,
        mapTypeControl: false,
        styles: [
            { elementType: 'geometry', stylers: [{ color: '#242f3e' }] },
            { elementType: 'labels.text.stroke', stylers: [{ color: '#242f3e' }] },
            { elementType: 'labels.text.fill', stylers: [{ color: '#746855' }] },
            {
                featureType: 'administrative.locality',
                elementType: 'labels.text.fill',
                stylers: [{ color: '#d59563' }]
            },
            {
                featureType: 'poi',
                stylers: [{ visibility: "off" }]
            },
            {
                featureType: 'road',
                elementType: 'geometry',
                stylers: [{ color: '#38414e' }]
            },
            {
                featureType: 'road',
                elementType: 'geometry.stroke',
                stylers: [{ color: '#212a37' }]
            },
            {
                featureType: 'road',
                elementType: 'labels.text.fill',
                stylers: [{ color: '#9ca5b3' }]
            },
            {
                featureType: 'road.highway',
                elementType: 'geometry',
                stylers: [{ color: '#746855' }]
            },
            {
                featureType: 'road.highway',
                elementType: 'geometry.stroke',
                stylers: [{ color: '#1f2835' }]
            },
            {
                featureType: 'road.highway',
                elementType: 'labels.text.fill',
                stylers: [{ color: '#f3d19c' }]
            },
            {
                featureType: 'transit',
                elementType: 'geometry',
                stylers: [{ color: '#2f3948' }]
            },
            {
                featureType: 'transit.station',
                elementType: 'labels.text.fill',
                stylers: [{ color: '#d59563' }]
            },
            {
                featureType: 'water',
                elementType: 'geometry',
                stylers: [{ color: '#17263c' }]
            },
            {
                featureType: 'water',
                elementType: 'labels.text.fill',
                stylers: [{ color: '#515c6d' }]
            },
            {
                featureType: 'water',
                elementType: 'labels.text.stroke',
                stylers: [{ color: '#17263c' }]
            }
        ]
    });
    getCollectionPoints()
    // setInterval(function () {
    //     getCollectionPoints()
    // }, 30000);
}



function deliverToThisLocation(el) {
    address_id = $(el).data('address')
    delivery_address_id = address_id
    changeAddress()
    renderAddress()
    infowindow.close()
    toastr["success"]('Address changed');
    $(window).scrollTop($('#activeAddressCard').offset().top - +100);
}

function getCPInfoWindow(cp) {
    var address = cp.address
    return contentString = `
<div class="address_card">
<u> COLLECTION POINT </u>
<p> Name: ${cp.name}</p>
<p> ${cp.email}, ${cp.mobile}</p>
<p> ${address.address_line1}</p>
<p> ${address.address_line2}</p>
<div class="btn btn-dark btn-sm edit-btn" data-address="${address._id}" onclick="deliverToThisLocation(this)"> Pickup from this collectionpoint </div>
</div>
`
}

function setCollectionPoints(collectionpoints) {
    var icon = {
        scaledSize: new google.maps.Size(50, 50),
        labelOrigin: new google.maps.Point(30, 50),
        url: icons.cp,
        origin: new google.maps.Point(0, 0),
        anchor: new google.maps.Point(11, 40),
    };

    $.each(collectionpoints, function (key, cp) {
        if (cp.location) {
            if (typeof cp.location.coordinates[1] == 'number' && typeof cp.location.coordinates[0] == 'number') {
                console.log(cp.location.coordinates)
                var position = new google.maps.LatLng(cp.location.coordinates[1], cp.location.coordinates[0]);
                if (typeof cps[cp._id] == 'undefined') {
                    cps[cp._id] = new google.maps.Marker({
                        map,
                        icon,
                        draggable: false,
                        // animation: google.maps.Animation.BOUNCE,
                        position,
                        address: cp.address,
                        name: cp.name,
                        email: cp.email,
                        mobile: cp.mobile
                    });
                    google.maps.event.addListener(cps[cp._id], 'click', function () {
                        if (infowindow) {
                            infowindow.close();
                        }
                        infowindow = new google.maps.InfoWindow({
                            content: getCPInfoWindow(cps[cp._id]),
                        });
                        infowindow.open(map, cps[cp._id]);
                    });
                    map.setZoom(16);
                    map.panTo(position);
                }
            }
        }
    })

}

function getDirections(lat, lng) {
    var point = new google.maps.LatLng(lat, lng)
    map.setZoom(16);
    map.panTo(point);
}

function renderCollectionPointTable(collectionpoints) {
    cp_list.clear()
    $.each(collectionpoints, function (key, cp) {
        cp_list.add({
            'item_cp': cp.name,
            'item_address': cp.address.address_line1,
            'item_location': `<a class="btn btn-success text-white" onclick="getDirections(${cp.location.coordinates[1]},${cp.location.coordinates[0]})"><i class="fa fa-map-marker"></i></a>`
        })
    })
}

function clearCPS() {
    for (var cp in cps) {
        cps[cp].setMap(null)
    }
    cps = {}
}

function getCollectionPoints() {
    clearCPS()
    $.ajax({
        url: `${APP_URL}/getcollectionpoints`,
        data: {
            selected_suburb
        },
        type: "GET",
        dataType: "json",
        success: function (data) {
            var {
                status,
                message,
                errors,
                collectionpoints
            } = data;
            errors = typeof errors != 'undefined' ? errors : []
            message = typeof message != 'undefined' ? message : null
            data = typeof data != 'undefined' ? data : {}
            if (status == true) {
                if (collectionpoints.length > 0) {
                    // renderCollectionPointTable(collectionpoints)
                    setCollectionPoints(collectionpoints)
                } else {
                    toastr['error']("No collection points at this suburb!")
                }
            }
        }
    });
    return false
}

function showSuburbModal() {
    $('.select2-show-search').select2("destroy").select2();
    $('#suburb_modal').modal('toggle')
}

$('#suburb-filter').on('change', function () {
    selected_suburb = $(this).val()
    if (selected_suburb == 'ALL') {
        selected_suburb = ''
    }
    getCollectionPoints()
})

function checkOut(el) {
    $(el).attr('disabled', true)
    items = products_list.get()
    var products = []
    var total_item_count = 0

    $.each(items, function (key, item) {
        var values = item.values()
        var {
            product_id
        } = values
        var count = $(`.count:eq(${key})`).val()
        if (count && count > 0) {
            products.push({
                product_id,
                count
            })
            total_item_count = total_item_count + +count
        }
    })

    if (delivery_type == 'express' && total_item_count < 3) {
        toastr['error']('There must be a minimum of 3 items ordered for delivery.')
        $(el).attr('disabled', false)
        return false
    }

    accessory_items = accessories_list.get()
    var accessories = []
    $.each(accessory_items, function (key, item) {
        var values = item.values()
        var {
            product_id
        } = values
        var count = $(`.acc-count:eq(${key})`).val()
        if (count && count > 0) {
            accessories.push({
                product_id,
                count
            })
        }
    })

    if (!delivery_address_id) {
        $.alert({
            title: 'Warning!',
            content: 'Please select a location to deliver',
        });
        $(el).attr('disabled', false)
        return false
    }
    var coupon = $('input[name="coupon"]').val()
    var pay_from_credit = 0
    if ($('input[name="pay_credit"]').is(':checked')) {
        pay_from_credit = 1
    }
    $.ajax({
        url: `${APP_URL}/checkout`,
        data: {
            products,
            accessories,
            address_id: delivery_address_id,
            coupon,
            pay_from_credit,
            selected_service_val
        },
        type: "POST",
        dataType: "json",
        success: function (data) {
            var {
                status,
                message,
                payment_page
            } = data;
            errors = typeof errors != 'undefined' ? errors : []
            message = typeof message != 'undefined' ? message : null
            payment_page = typeof payment_page != 'undefined' ? payment_page : ""
            if (status == false) {
                toastr['error'](message)
            } else {
                window.location.href = payment_page
            }
            $(el).attr('disabled', false)
        }
    });
    return false
}

function hideandshow() {
    if (document.getElementById("btns-2").onclick) {
        document.getElementById("map_wrap").style.display = 'none';
        document.getElementById("btns-2").classList.add("bgactive");
        document.getElementById("btns-1").classList.remove("bgactive");
    }
}
$("#proceedtopay").hide();
$(function () {
    $(document).scroll(function () {
        if ($(this).scrollTop() > 300) {
            $("#proceedtopay").fadeIn();
        }
        else {
            $("#proceedtopay").fadeOut();
        }
    });
});