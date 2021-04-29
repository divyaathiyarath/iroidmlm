exports.trimMobile = (mobile) => {
    mobile = mobile.trim()
    mobile = mobile.split(" ").join("")
    mobile = mobile.split("-").join("")
    mobile = mobile.split("(").join("")
    mobile = mobile.split(")").join("")
    if (mobile.length > 9) {
        switch (true) {
            case mobile.startsWith('061'):
                mobile = mobile.substr(3);
                break;
            case mobile.startsWith('+61'):
                mobile = mobile.substr(3);
                break;
            case mobile.startsWith('61'):
                mobile = mobile.substr(2);
                break;
            case mobile.startsWith('0'):
                mobile = mobile.substr(1);
                break;
        }
    }
    return mobile;
}