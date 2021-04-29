function getPriceDetails() {
  var products = [];
  var accessories_items = [];
  var item_count = 0;
  var item_total = 0;
  var balance_to_pay = 0;
  var credit_used = 0;
  var service_charge = 0;
  var to_be_credited = 0;
  var total_delivery_charge = 0;
  var discount_price = 0;
  var total = 0;
  var paid_price = $("#paid").val();

  var items = products_list.get();
  var accessories = accessories_list.get();
  food_credits = parseFloat(food_credits);

  let tmp_credits = food_credits;

  old_product_price = +old_product_price;
  old_item_count = +old_item_count;

  let has_delivery_charge = 0;
  if (delivery_type == "express") {
    has_delivery_charge = 1;
  }

  $.each(items, function (key, item) {
    var values = item.values();
    var { product_id, "data-price": price, name } = values;
    var count = $(`.count:eq(${key})`).val();
    if (count && count > 0) {
      products.push({
        product_id,
        count: +count,
        name,
        price: +price,
        total: +count * +price,
      });
      item_count = item_count + +count;
      item_total += +price * +count;
    }
  });

  $.each(accessories, function (key, item) {
    var values = item.values();
    var { "data-price": price, product_id, name } = values;
    var count = $(`.acc-count:eq(${key})`).val();
    if (count && count > 0) {
      accessories_items.push({
        product_id,
        count: +count,
        name,
        price: +price,
        total: +count * +price,
      });
      item_total += +price * +count;
    }
  });

  var new_total = item_total - old_product_price;
  var new_item_count = item_count - old_item_count;
  if (new_total < 0) {
    to_be_credited = Math.abs(new_total);
    if (new_item_count < 0 && has_delivery_charge) {
      to_be_credited += Math.abs(new_item_count) * +delivery_charge;
    }
  } else {
    balance_to_pay = new_total;
    if (new_item_count > 0 && has_delivery_charge) {
      total_delivery_charge = new_item_count * delivery_charge;
      balance_to_pay += total_delivery_charge;
    }
    if (balance_to_pay > 0) {
      //check credits
      if (tmp_credits > balance_to_pay && tmp_credits > 1) {
        credit_used = balance_to_pay;
        balance_to_pay = 0;
      } else if (tmp_credits > 1) {
        credit_used = tmp_credits;
        balance_to_pay -= credit_used;
      }

      if (balance_to_pay > 0) {
        if (service_charge_square && selected_payment_gateway == "square") {
          service_charge = balance_to_pay * (service_charge_square / 100);
        }else if(service_charge_paypal && selected_payment_gateway == "paypal") {
          service_charge = balance_to_pay * (service_charge_paypal / 100);
        }
        balance_to_pay += service_charge;
      }
    }
  }

  total = item_total + balance_to_pay;

  return {
    products,
    accessories_items,
    item_count,
    item_total,
    balance_to_pay,
    credit_used,
    service_charge,
    to_be_credited,
    total,
    total_delivery_charge,
    discount_price,
    paid: +paid_price,
  };
}

var checkoutconfirm = "";
selected_service = `
            <li>
                <label><input type="radio" value="square" name="payment_service" onclick="changePaymentGateway('square')" checked/> Squareup</label> 
                <label><input type="radio" value="paypal" name="payment_service" onclick="changePaymentGateway('paypal')" /> Paypal</label>
            </li>
        `;
selected_service_val = "square";
function changePaymentGateway(gateway) {
  selected_payment_gateway = gateway;
  if (gateway == "square") {
    selected_service = `
            <li>
                <label><input type="radio" value="square" name="payment_service" onclick="changePaymentGateway('square')" checked/> Squareup</label> 
                <label><input type="radio" value="paypal" name="payment_service" onclick="changePaymentGateway('paypal')" /> Paypal</label>
            </li>
        `;
    selected_service_val = "square";
  } else {
    selected_service = `
            <li>
                <label><input type="radio" value="square" name="payment_service" onclick="changePaymentGateway('square')"/> Squareup</label> 
                <label><input type="radio" value="paypal" name="payment_service" onclick="changePaymentGateway('paypal')" checked/> Paypal</label>
            </li>
        `;
    selected_service_val = "paypal";
  }
  checkoutconfirm.close();
  checkOrder();
}

function checkOrder() {
  var {
    item_count,
    item_total,
    total_delivery_charge,
    paid,
    discount_price,
    balance_to_pay,
    to_be_credited,
    credit_used,
    service_charge,
    products,
    accessories_items,
  } = (data = getPriceDetails());
  console.log(data);
  var product_html = "";
  var credit_used_html = "";
  var balance_tobe_credited = "";
  var payment_service_charge = "";

  if (!scheduled_date) {
    //check date
    toastr["error"]("Please select scheduled date");
    return false;
  }

  shift_id = $("#select-shift").val(); //check shift
  if (!shift_id) {
    toastr["error"]("Please select shift");
    return false;
  }

  let break_time = $('input[name="break_time"]').val()

  if (products.length <= 0) {
    toastr["error"]("No products selected");
    return false;
  }

  if (delivery_type == "express" && item_count < 3) {
    toastr["error"]("There must be a minimum of 3 items ordered for delivery.");
    return false;
  }

  if (products.length > 0) {
    products.map((product) => {
      var { count, name, total } = product;
      product_html += `
                <li>
                    <div> (x${count}) ${name} </div>
                    <div><span> $${total.toFixed(2)}</span></div>
                </li>
            `;
    });

    if (accessories_items.length > 0) {
      accessories_items.map((product) => {
        var { count, name, total } = product;
        product_html += `
                    <li>
                        <div> (x${count}) ${name} </div>
                        <div><span> $${total.toFixed(2)}</span></div>
                    </li>
                `;
      });
    }
  }

  if (credit_used) {
    credit_used_html += `
                    <li>
                        <div> Credit Used </div>
                        <div> $${credit_used.toFixed(2)}</div>
                    </li>
                `;
  }

  if (to_be_credited) {
    balance_tobe_credited += `
                <li>
                    <div> Balance to be credited </div>
                    <div> $${to_be_credited.toFixed(2)}</div>
                </li>
            `;
  }

  if(service_charge){
    payment_service_charge = `
      <li>
        <div> Service Charge </div>
        <div> $${service_charge.toFixed(2)}</div>
      </li>
    `
  }

  var pricingHtml = `        
        <ul>
            ${product_html}
            <li class="hr"> </li>
            <li>
                <div> Item Total </div>
                <div><span> $${item_total.toFixed(2)}</span></div>
            </li>
            <li>
                <div> Delivery charge </div>
                <div> $${total_delivery_charge.toFixed(2)}</div>
            </li> 
            ${payment_service_charge}      
            ${selected_service}         
            <li class="hr"></li>
            <li>
                <div> Discount Price</div>
                <div> $${discount_price.toFixed(2)}</div>
            </li>   
            <li>
                <div> Paid Price</div>
                <div> $${paid.toFixed(2)}</div>
            </li> 
            ${credit_used_html}
            <li class="total">
                <div> Total to pay (*Incl. GST) </div>
                <div> $${balance_to_pay.toFixed(2)}</div>
            </li>
            ${balance_tobe_credited}
        </ul>
    `;

  checkoutconfirm = $.confirm({
    title: "Checkout confirmation",
    content: "",
    onContentReady: function () {
      var self = this;
      this.setContentPrepend(`
            <div class="">
                <div class="payment_details_con" style="max-width:100% !important">
                    ${pricingHtml}
                </div>
            </div>                
            `);
    },
    columnClass: "medium",
    buttons: {
      confirm: {
        text: "Confirm Order",
        btnClass: "btn btn-primary btn-lg btn-round",
        keys: ["enter"],
        action: function () {
          $.confirm({
            title: "Confirm order",
            content: function () {
              var self = this;
              self.setContent("");
              var coupon = $('input[name="coupon"]').val();
              return $.ajax({
                url: `${ASSET_URL}/updateschedulebooking`,
                data: {
                  address_id: delivery_address_id,
                  scheduled_date,
                  shift,
                  products,
                  accessories: accessories_items,
                  order_id,
                  selected_service : selected_service_val,
                  break_time
                },
                dataType: "json",
                method: "POST",
              })
                .done(function (response) {
                  console.log(response);
                  var { status, errors, message, payment_page } = response;
                  if (status == true) {
                    if (payment_page) {
                      window.location.href = payment_page;
                      self.setContentAppend(
                        `<div class="alert alert-success">Redirecting to payment...</div>`
                      );
                    } else {
                      window.location.href = APP_URL + "/success";
                      self.setContentAppend(
                        `<div class="alert alert-success">${message}</div>`
                      );
                    }
                  } else {
                    self.close();
                    toastr["error"](message);
                  }
                })
                .fail(function () {
                  self.setContentAppend(
                    '<div class="alert alert-danger">Scheduled order failed</div>'
                  );
                })
                .always(function () {
                  // self.setContentAppend('<div>Always!</div>');
                });
            },
            contentLoaded: function (data, status, xhr) {
              // self.setContentAppend('<div>Content loaded!</div>');
            },
            onContentReady: function () {
              // this.setContentAppend('<div>Content ready!</div>');
            },
            buttons: {
              close: function () {
                window.location.href = APP_URL + "/scheduled";
              },
            },
          });
        },
      },
      cancel: {
        text: "Cancel",
        btnClass: "btn btn-primary btn-lg btn-round",
        keys: ["enter"],
        action: function () {
          // $.alert('Order ');
        },
      },
    },
  });

  return false;
}

function changeDeliveryType(type) {
  $("#delivery-panel").html("");
  var html = "";
  if (type == "express") {
    html += `
        <div class="shop_card express">
            <img src="${ASSET_URL}/public/web/images/delivery_vehicle.svg" alt="">
            <div class="shop_details">
                <h3> Delivery </h3>
                <p class="blackt"> You have opted for Delivery Service. Delivery will deliver the order in your doorstep. Delivery charge of $1.65 is applicable for each food item. You  can also opt for a collection point from the above map, where you can go and pick the food from that selected location(Delivery charge not applicable here) </p>
            </div>
        </div>
        `;
  } else if (type == "shop") {
    html += `
        <div class="shop_card shop" hidden>
            <img src="${ASSET_URL}/public/web/images/shop-icon.svg" alt="">
            <div class="shop_details">
                <h3> RiceNGrills Shop </h3>
                <p class="blackt">You have opted Collection Point. From the user selected collection point RNG Foods will be collected by showing order ID or QR code that generated. You can also opt for Delivery services where our delivery partner will deliver your order in your doorstep. Delivery charge of $1.65 is applicable for each food item for Delivery service. </p>
            </div>
        </div>
        `;
  } else if (type == "office") {
    html += `
        <div class="shop_card shop" hidden>
            <img src="${ASSET_URL}/public/web/images/office.png" alt="">
            <div class="shop_details">
                <h3> Office </h3>
                <p class="blackt">You have opted Office. From the user selected office RNG Foods will be collected by showing order ID or QR code that generated. You can also opt for Delivery services where our delivery partner will deliver your order in your doorstep. Delivery charge of $1.65 is applicable for each food item for Delivery service. </p>
            </div>
        </div>
        `;
  }
  $("#delivery-panel").html(html);
}

function changeAddress() {
  $.ajax({
    url: `${ASSET_URL}/setaddress`,
    data: {
      address_id: delivery_address_id,
    },
    type: "GET",
    dataType: "json",
    success: function (data) {
      var { status } = data;
      if (status) {
        console.log("Address changed");
      }
    },
  });
}

function chooseUserAddress(el) {
  $("#addresses-modal").modal("toggle");
}

function deliverToThisLocation(el) {
  address_id = $(el).data("address");
  delivery_address_id = address_id;
  changeAddress();
  renderAddress();
  infowindow.close();
  toastr["success"]("Address changed");
  $(window).scrollTop($("#activeAddressCard").offset().top - +100);
}

function renderAddress() {
  $("#addresses-modal").modal("hide");
  $.ajax({
    url: `${ASSET_URL}/addressdetails`,
    data: {
      address_id: delivery_address_id,
    },
    type: "GET",
    dataType: "json",
    success: function (data) {
      var { status, address } = data;
      var html = "";
      if (address) {
        var {
          _id,
          type,
          address_line1,
          address_line2,
          address_type,
          appartment,
          contact_person,
          house_flat_no,
          landmark,
          to_reach,
        } = address;
        if (type == "USER") {
          delivery_type = "express";
          changeDeliveryType("express");
          html += `
                        <u> ${address_type} </u>
                        <p> ${address_line1}</p>
                        <p> ${house_flat_no},${appartment} </p>
                        <p> Street name: ${landmark}</p>
                        <p> Instructions reach location: ${to_reach}</p>
                    `;
          $("#delivery_check").prop("checked", true);
          $(".delivery_address_sec").show();
          $(".pickup_address_sec").hide();
          $(".office_address_sec").hide();
          $(".google_map_fluid").fadeOut("slow");
        } else if (type == "COLLECTION_POINT") {
          delivery_type = "shop";
          changeDeliveryType("shop");
          html += `
                        <u> COLLECTION POINT </u>
                        <p> ${address_line1}</p>
                        <p> ${address_line2} </p>
                    `;
          $("#pickup_check").prop("checked", true);
          $(".pickup_address_sec").show();
          $(".delivery_address_sec").hide();
          $(".office_address_sec").hide();
          $(".google_map_fluid").fadeIn("slow");
        } else if (type == "OFFICE") {
          delivery_type = "office";
          changeDeliveryType("office");
          html += `
                        <u> OFFICE </u>
                        <p> ${address_line1}</p>
                        <p> ${address_line2} </p>
                    `;
          $("#company_check").prop("checked", true);
          $(".office_address_sec").show();
          $(".pickup_address_sec").hide();
          $(".delivery_address_sec").hide();
          $(".google_map_fluid").fadeOut("slow");
        }

        $('select[name="delivery_address_id"]').val(delivery_address_id);
        $('select[name="delivery_address_id"]').select2("destroy");
        $('select[name="delivery_address_id"]').select2();
      }
      $("#activeAddressCard").html(html);
    },
  });
  return false;
}

function initMap() {
  map = new google.maps.Map(document.getElementById("map"), {
    zoom: 16,
    center: initloc,
    mapTypeId: google.maps.MapTypeId.ROADMAP,
    mapTypeControl: false,
    styles: [
      { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
      { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
      { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
      {
        featureType: "administrative.locality",
        elementType: "labels.text.fill",
        stylers: [{ color: "#d59563" }],
      },
      {
        featureType: "poi",
        elementType: "labels.text.fill",
        stylers: [{ color: "#d59563" }],
      },
      {
        featureType: "poi.park",
        elementType: "geometry",
        stylers: [{ color: "#263c3f" }],
      },
      {
        featureType: "poi.park",
        elementType: "labels.text.fill",
        stylers: [{ color: "#6b9a76" }],
      },
      {
        featureType: "road",
        elementType: "geometry",
        stylers: [{ color: "#38414e" }],
      },
      {
        featureType: "road",
        elementType: "geometry.stroke",
        stylers: [{ color: "#212a37" }],
      },
      {
        featureType: "road",
        elementType: "labels.text.fill",
        stylers: [{ color: "#9ca5b3" }],
      },
      {
        featureType: "road.highway",
        elementType: "geometry",
        stylers: [{ color: "#746855" }],
      },
      {
        featureType: "road.highway",
        elementType: "geometry.stroke",
        stylers: [{ color: "#1f2835" }],
      },
      {
        featureType: "road.highway",
        elementType: "labels.text.fill",
        stylers: [{ color: "#f3d19c" }],
      },
      {
        featureType: "transit",
        elementType: "geometry",
        stylers: [{ color: "#2f3948" }],
      },
      {
        featureType: "transit.station",
        elementType: "labels.text.fill",
        stylers: [{ color: "#d59563" }],
      },
      {
        featureType: "water",
        elementType: "geometry",
        stylers: [{ color: "#17263c" }],
      },
      {
        featureType: "water",
        elementType: "labels.text.fill",
        stylers: [{ color: "#515c6d" }],
      },
      {
        featureType: "water",
        elementType: "labels.text.stroke",
        stylers: [{ color: "#17263c" }],
      },
    ],
  });
  getCollectionPoints();
  // setInterval(function () {
  //     getCollectionPoints()
  // }, 30000);
}

function getCPInfoWindow(cp) {
  var address = cp.address;
  return (contentString = `
                    <div class="address_card">
                        <u> COLLECTION POINT </u>
                        <p> Name: ${cp.name}</p>
                        <p> ${cp.email}, ${cp.mobile}</p>
                        <p> ${address.address_line1}</p>
                        <p> ${address.address_line2}</p>
                        <div class="btn btn-dark btn-sm edit-btn" data-address="${address._id}" onclick="deliverToThisLocation(this)"> Pickup from this collectionpoint </div>
                    </div>
    `);
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
      if (
        typeof cp.location.coordinates[1] == "number" &&
        typeof cp.location.coordinates[0] == "number"
      ) {
        console.log(cp.location.coordinates);
        var position = new google.maps.LatLng(
          cp.location.coordinates[1],
          cp.location.coordinates[0]
        );
        if (typeof cps[cp._id] == "undefined") {
          cps[cp._id] = new google.maps.Marker({
            map,
            icon,
            draggable: false,
            animation: google.maps.Animation.BOUNCE,
            position,
            address: cp.address,
            name: cp.name,
            email: cp.email,
            mobile: cp.mobile,
          });
          google.maps.event.addListener(cps[cp._id], "click", function () {
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
  });
}

function getDirections(lat, lng) {
  var point = new google.maps.LatLng(lat, lng);
  map.setZoom(16);
  map.panTo(point);
}

function renderCollectionPointTable(collectionpoints) {
  cp_list.clear();
  $.each(collectionpoints, function (key, cp) {
    cp_list.add({
      item_cp: cp.name,
      item_address: cp.address.address_line1,
      item_location: `<a class="btn btn-success text-white" onclick="getDirections(${cp.location.coordinates[1]},${cp.location.coordinates[0]})"><i class="fa fa-map-marker"></i></a>`,
    });
  });
}

function clearCPS() {
  for (var cp in cps) {
    cps[cp].setMap(null);
  }
  cps = {};
}

function getCollectionPoints() {
  clearCPS();
  $.ajax({
    url: `${ASSET_URL}/getcollectionpoints`,
    data: {
      selected_suburb,
    },
    type: "GET",
    dataType: "json",
    success: function (data) {
      var { status, message, errors, collectionpoints } = data;
      errors = typeof errors != "undefined" ? errors : [];
      message = typeof message != "undefined" ? message : null;
      data = typeof data != "undefined" ? data : {};
      if (status == true) {
        if (collectionpoints.length > 0) {
          // renderCollectionPointTable(collectionpoints)
          setCollectionPoints(collectionpoints);
        } else {
          toastr["error"]("No collection points at this suburb!");
        }
      }
    },
  });
  return false;
}

function showSuburbModal() {
  $(".select2-show-search").select2("destroy").select2();
  $("#suburb_modal").modal("toggle");
}

$("#suburb-filter").on("change", function () {
  selected_suburb = $(this).val();
  if (selected_suburb == "ALL") {
    selected_suburb = "";
  }
  getCollectionPoints();
});

var options = {
  valueNames: [
    { name: "image", attr: "src" },
    "name",
    "price",
    { name: "data-price", selector: ".price", attr: "data-price" },
    { name: "count", attr: "value" },
    { name: "product_id", selector: ".product_id", attr: "data-product" },
  ],
  item: `<div class="col-lg-3 col-sm-6 col-12">
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
                                <input data-min="0" data-max="0" type="text" name="count[]" value="0" readonly="true" class="count data-price" data-price>
                                <div class="quantity-selectors-container"> </div>
                            </div>
                        </div>
                        <h3>$<span class="price"></span></h3>                           
                    </div>
                </div>`,
};

var products_list = new List("products_list", options);

var options2 = {
  valueNames: [
    { name: "image", attr: "src" },
    "name",
    "price",
    { name: "data-price", selector: ".price", attr: "data-price" },
    { name: "count", attr: "value" },
    { name: "product_id", selector: ".product_id", attr: "data-product" },
  ],
  item: `<div class="col-lg-3 col-sm-6 col-12">
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
                                <input data-min="0" data-max="0" type="text" name="count[]" value="0" readonly="true" class="count acc-count data-price" data-price>
                                <div class="quantity-selectors-container"> </div>
                            </div>
                        </div>
                        <h3>$<span class="price"></span></h3>
                    </div>
                </div>`,
};
var accessories_list = new List("accessories_list", options2);

function getOrderDetails() {
  $.ajax({
    url: `${ASSET_URL}/getorderdetails`,
    data: {
      order_id,
    },
    type: "GET",
    dataType: "json",
    success: function (data) {
      var { status, booking, payment } = data;
      let { address_id, scheduled_date, shift_id, orders } = booking;
      let { total_price, discount_price, service_charge } = payment;

      $('input[name="discount"]').val(discount_price);
      $('input[name="paid"]').val(total_price);
      $('input[name="service_charge"]').val(service_charge);

      if (address_id) {
        delivery_address_id = address_id;
      }
      if (scheduled_date) {
        $(".date-select").val(moment(scheduled_date).format("YYYY-MM-DD"));
        $(".date-select").trigger("change");
        // $('.date-select').attr('disabled', true)
      }
      if (shift_id) {
        shift = shift_id;
        $('select[name="shift"]').val(shift_id);
        // $('select[name="shift"]').attr('disabled', true)
      }
      if (orders.length > 0) {
        orders.forEach((order) => {
          var { product_id, quantity } = order;
          var items = products_list.get("product_id", product_id);
          $.each(items, function (key, item) {
            var values = item.values();
            // console.log({values})
            values.price = (values["data-price"] * quantity).toFixed(2);
            values.count = quantity;
            products_list.remove("product_id", product_id);
            products_list.add(values);
          });
          products_list.sort("price", { order: "desc" });
        });

        orders.forEach((order) => {
          var { product_id, quantity } = order;
          var items = accessories_list.get("product_id", product_id);
          $.each(items, function (key, item) {
            var values = item.values();
            // console.log({values})
            values.price = (values["data-price"] * quantity).toFixed(2);
            values.count = quantity;
            accessories_list.remove("product_id", product_id);
            accessories_list.add(values);
          });
          accessories_list.sort("price", { order: "desc" });
        });
      }
      renderAddress();
    },
  });
  return false;
}

function renderRegularProducts() {
  $.ajax({
    url: `${ASSET_URL}/regularproducts`,
    data: {
      food_only: 0,
    },
    type: "GET",
    dataType: "json",
    success: function (data) {
      var { status, products } = data;
      console.log({ products });
      if (products.length > 0) {
        var has_accessories = 0;
        $.each(products, function (key, product) {
          // console.log({ product })
          var { _id, name, image, price, allergen_contents, type } = product;
          if (type == "FOOD") {
            products_list.add({
              image: ASSET_URL + "/" + image,
              name: name,
              price: price.toFixed(2),
              "data-price": price.toFixed(2),
              count: 0,
              product_id: _id,
              allergen_contents: allergen_contents,
            });
          } else {
            has_accessories = 1;
            accessories_list.add({
              image: ASSET_URL + "/" + image,
              name: name,
              price: price.toFixed(2),
              "data-price": price.toFixed(2),
              count: 0,
              product_id: _id,
              allergen_contents: allergen_contents,
            });
          }
        });

        if (has_accessories == 0) {
          $(".acccessories_heading").html("");
        }

        products_list.sort("price", { order: "desc" });
        accessories_list.sort("price", { order: "desc" });
        getOrderDetails();
      }
    },
  });
  return false;
}
renderRegularProducts();

