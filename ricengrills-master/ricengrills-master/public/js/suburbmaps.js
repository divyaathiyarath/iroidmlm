let placeSearch;
let autocomplete;

function checkLatLng(el) {
    var val = $(el).val();
    if (!val) {
        $('#input-lat').val(``);
        $('#input-lng').val(``);
    }
    var lat = $('#input-lat').val();
    if (!lat) {
        $(el).val(``);
    }
}

function fillInAddress() {
    const place = autocomplete.getPlace();
    var address = [];
    for (const component of place.address_components) {
        address.push(component['long_name']);
    }
    address = address.join(',')
    var geocoder = new google.maps.Geocoder();
    geocoder.geocode({
        'address': address
    }, function(results, status) {
        if (status == google.maps.GeocoderStatus.OK) {
            var latitude = results[0].geometry.location.lat();
            var longitude = results[0].geometry.location.lng();
            $('#input-lat').val(latitude)
            $('#input-lng').val(longitude)
            initloc = {
                lat: latitude,
                lng: longitude
            }
            initMap();
        }
    });


}

function geolocate() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(position => {
            const geolocation = {
                lat: position.coords.latitude,
                lng: position.coords.longitude
            };
            const circle = new google.maps.Circle({
                center: geolocation,
                radius: position.coords.accuracy
            });
            autocomplete.setBounds(circle.getBounds());
        });
    }
}

function initMap() {
    autocomplete = new google.maps.places.Autocomplete(
        document.getElementById("autocomplete"), {
            // types: ["geocode",]
        }
    );
    autocomplete.setFields(["address_component"]);
    autocomplete.addListener("place_changed", fillInAddress);
    var map = new google.maps.Map(document.getElementById('map'), {
        zoom: 8,
        center: initloc
    }); // The marker,
    marker = new google.maps.Marker({
        map: map,
        draggable: true,
        animation: google.maps.Animation.DROP,
        position: initloc
    });
    google.maps.event.addListener(marker, 'dragend', function() {
        geocodePosition(marker.getPosition());
    });

    function geocodePosition(pos) {
        geocoder = new google.maps.Geocoder();
        geocoder.geocode({
                latLng: pos
            },
            function(results, status) {
                if (status == google.maps.GeocoderStatus.OK) {
                    var latitude = results[0].geometry.location.lat();
                    var longitude = results[0].geometry.location.lng();

                    $('#input-lat').val(latitude)
                    $('#input-lng').val(longitude)

                    $("#autocomplete").val(results[0].formatted_address);
                    $("#mapErrorMsg").hide(100);
                } else {
                    $("#mapErrorMsg").html('Cannot determine address at this location.' + status).show(100);
                }
            }
        );
    }
}