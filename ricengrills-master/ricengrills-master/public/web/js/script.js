function changeQuantities(el) {
  // alert()
  console.log("Here in change quantities")
  var input_selector = $(el).parent().parent().find('input[name="count[]"]')
  var currentQty = $(input_selector).val();
  var price = $(input_selector).data('price')
  var cart = $(input_selector).data('cart')
  var accessory = $(input_selector).data('accessory')
  var qtyDirection = $(el).data("direction");
  var newQty = 0;

  console.log({
    price,
    cart,
    accessory,
    qtyDirection,
    newQty,
    currentQty
  })

  if (qtyDirection == "1") {
    newQty = parseInt(currentQty) + 1;
  }
  else if (qtyDirection == "-1") {
    newQty = parseInt(currentQty) - 1;
  }

  // make decrement disabled at 1
  if (cart) {
    if (newQty == 1) {
      $(el).parent().parent().find(".decrement-quantity").attr("disabled", "disabled");
    }
    // remove disabled attribute on subtract
    if (newQty > 1) {
      $(el).parent().parent().find(".decrement-quantity").removeAttr("disabled");
    }
  } else {
    if (newQty == 0) {
      $(el).parent().parent().find(".decrement-quantity").attr("disabled", "disabled");
    }
    // remove disabled attribute on subtract
    if (newQty > 0) {
      $(el).parent().parent().find(".decrement-quantity").removeAttr("disabled");
    }
  }
  if (newQty > 0) {
    var tot = newQty * price
    newQty = newQty.toString();
    $(input_selector).parent().parent().parent().find('.price').html(tot.toFixed(2))
    $(input_selector).val(newQty);
    $(input_selector).parent().parent().parent().find('.price').parent().css('color', 'green')
  }
  else {
    $(input_selector).parent().parent().parent().find('.price').parent().css('color', 'black')
    $(input_selector).val("0");
  }

  if(cart || accessory){
    renderPricing()
  }

}


// Date Picker
$('.date').datepicker({
  multidate: true,
  format: 'yyyy-mm-dd',
  clearBtn: true,
  autoclose: true
});

$('.date_single').datepicker({
  multidate: false,
  format: 'yyyy-mm-dd',
  clearBtn: true,  
  startDate: '+0d',
  autoclose: true
});

$('.date_next').datepicker({
  multidate: false,
  format: 'yyyy-mm-dd',
  clearBtn: true,
  startDate: '+1d',
  autoclose: true
});


// ============== Preloader start  ==============
$(window).on("load", function () {
  // makes sure the whole site is loaded
  $("#status").fadeOut(); // will first fade out the loading animation
  $("#preloader")
    .delay(500)
    .fadeOut("slow"); // will fade out the white DIV that covers the website.
  $("body")
    .delay(500)
    .css({ overflow: "visible" });
});
// ============== Preloader end  ==============

// Wow

wow = new WOW(
  {
    boxClass: 'wow',      // default
    animateClass: 'animate__animated', // default
    offset: 0,          // default
    mobile: true,       // default
    live: true        // default
  }
)
wow.init();

// Wow

// Modal Open

$(window).on('load', function () {
  $('#choose_delivery').modal('show');
});

// Modal Open end