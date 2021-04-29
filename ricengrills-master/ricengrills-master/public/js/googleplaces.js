"use strict";

// This sample uses the Autocomplete widget to help the user select a
// place, then it retrieves the address components associated with that
// place, and then it populates the form fields with those details.
// This sample requires the Places library. Include the libraries=places
// parameter when you first load the API. For example:
// <script
// src="https://maps.googleapis.com/maps/api/js?key=AIzaSyCPJpjD-qcR_yIxJnS8maR5W9KB0E3EzYI&libraries=places">
let placeSearch;
let autocomplete;
const componentForm = {
    address_line1: "long_name",
    address_line2: "long_name",
};

// const componentForm = {
//     street_number: "short_name",
//     route: "long_name",
//     locality: "long_name",
//     administrative_area_level_1: "short_name",
//     country: "long_name",
//     postal_code: "short_name"
// };

function initAutocomplete() {
    // Create the autocomplete object, restricting the search predictions to
    // geographical location types.
    autocomplete = new google.maps.places.Autocomplete(
        document.getElementById("autocomplete"), {
            // types: ["geocode",]
        }
    ); // Avoid paying for data that you don't need by restricting the set of
    // place fields that are returned to just the address components.

    autocomplete.setFields(["address_component"]); // When the user selects an address from the drop-down, populate the
    // address fields in the form.

    autocomplete.addListener("place_changed", fillInAddress);
}

function fillInAddress() {
    const place = autocomplete.getPlace();
    console.log({ location })
    var address = [];
    for (const component of place.address_components) {
        address.push(component['long_name']);
    }
    address = address.join(',')
    var geocoder = new google.maps.Geocoder();
    geocoder.geocode({ 'address': address }, function(results, status) {
        if (status == google.maps.GeocoderStatus.OK) {
            var latitude = results[0].geometry.location.lat();
            var longitude = results[0].geometry.location.lng();
            $('#input-lat').val(latitude)
            $('#input-lng').val(longitude)
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