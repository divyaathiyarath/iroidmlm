const QRCode =  require('qrcode')

exports.generateQrCode = async data => {
    // qrcode = await QRCode.toDataURL(text)
    await QRCode.toDataURL(data)
}