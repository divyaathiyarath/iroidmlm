const sgMail = require("@sendgrid/mail");
const config = require("config");
const from_email = config.ADMIN_FROM_EMAIL;
sgMail.setApiKey(config.SENDGRID_API_KEY);
exports.sendMagicLink = async (data) => {
  const { name, reset_link, email } = data;
  try {
    const msg = {
      to: email,
      from: from_email,
      subject: "RICE N GRILLS - Forgot password",
      text: "Please find the magic link",
      html:`<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
      <html xmlns="http://www.w3.org/1999/xhtml">
      <head>
          <!--[if gte mso 15]>
          <xml>
              <o:OfficeDocumentSettings>
              <o:AllowPNG/>
              <o:PixelsPerInch>96</o:PixelsPerInch>
              </o:OfficeDocumentSettings>
          </xml>
          <![endif]-->
          <meta http-equiv="Content-type" content="text/html; charset=utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
          <meta http-equiv="X-UA-Compatible" content="IE=edge" />
          <meta name="format-detection" content="date=no" />
          <meta name="format-detection" content="address=no" />
          <meta name="format-detection" content="telephone=no" />
          <link href='https://fonts.googleapis.com/css?family=Source+Sans+Pro:400,400italic,700italic,700' rel='stylesheet' type='text/css' />
          <title>Rice N Grills</title>
          
      
          <style type="text/css" media="screen">
              [style*="SSP"] { font-family: 'Source Sans Pro', Arial, sans-serif !important }
              /* Linked Styles */
              body { padding:0 !important; margin:0 !important; display:block !important; min-width:100% !important; width:100% !important; background:#55544d; -webkit-text-size-adjust:none }
              a { color:#949490; text-decoration:underline }
              p { padding:0 !important; margin:0 !important } 
              img { -ms-interpolation-mode: bicubic; /* Allow smoother rendering of resized image in Internet Explorer */ }
      
              /* Mobile styles */
              @media only screen and (max-device-width: 480px), only screen and (max-width: 480px) { 
                  div[class='mobile-br-1'] { height: 1px !important; display: block !important; background: #e9e8e2 !important; }
                  div[class='mobile-br-5'] { height: 5px !important; }
                  div[class='mobile-br-10'] { height: 10px !important; }
                  div[class='mobile-br-15'] { height: 15px !important; }
                  div[class='mobile-br-20'] { height: 20px !important; }
                  div[class='mobile-br-25'] { height: 25px !important; }
      
                  th[class='m-td'], 
                  td[class='m-td'], 
                  div[class='hide-for-mobile'], 
                  span[class='hide-for-mobile'] { display: none !important; width: 0 !important; height: 0 !important; font-size: 0 !important; line-height: 0 !important; min-height: 0 !important; }
      
                  span[class='mobile-block'] { display: block !important; }
      
                  div[class='text-footer'],
                  td[class='text-footer'],
                  div[class='text-footer-r'],
                  td[class='text-footer-r'],
                  div[class='img-m-center'] { text-align: center !important; }
      
                  div[class='fluid-img'] img,
                  td[class='fluid-img'] img { width: 100% !important; max-width: 100% !important; height: auto !important; }
      
                  table[class='mobile-shell'] { width: 100% !important; min-width: 100% !important; }
                  table[class='center'] { margin: 0 auto; }
                  
                  td[class='column'],
                  th[class='column'] { float: left !important; width: 100% !important; display: block !important; }
      
                  td[class='td'] { width: 100% !important; min-width: 100% !important; }
                  td[class='bg'] {
                      background-size: cover !important; 
                      background-repeat: no-repeat !important;
                      background-position: center center !important; 
                  }
                  td[class='content-spacing'] { width: 15px !important; }
              } 
          </style>
      </head>
      <body class="body" style="padding:0 !important; margin:0 !important; display:block !important; min-width:100% !important; width:100% !important; background:#55544d; -webkit-text-size-adjust:none">
          <table width="100%" border="0" cellspacing="0" cellpadding="0" bgcolor="#55544d">
              <tr>
                  <td align="center" valign="top">
                      <table width="650" border="0" cellspacing="0" cellpadding="0" class="mobile-shell">
                          <tr>
                              <td class="td" style="width:650px; min-width:650px; font-size:0pt; line-height:0pt; padding:0; margin:0; font-weight:normal; Margin:0">
                                  <!-- Header -->
                                  <table width="100%" border="0" cellspacing="0" cellpadding="0">
                                      <tr>
                                          <td>
                                              <table width="100%" border="0" cellspacing="0" cellpadding="0" class="spacer" style="font-size:0pt; line-height:0pt; text-align:center; width:100%; min-width:100%"><tr><td height="30" class="spacer" style="font-size:0pt; line-height:0pt; text-align:center; width:100%; min-width:100%">&nbsp;</td></tr></table>
      
                                              <!-- Top Bar -->
                                              <table width="100%" border="0" cellspacing="0" cellpadding="0">
                                                  <tr>
                                                      <td align="right">
                                                          <table border="0" cellspacing="0" cellpadding="0">
                                                              <tr>
                                                                  
                                                                  <td class="img" style="font-size:0pt; line-height:0pt; text-align:left" width="1"></td>
                                                                  <td>
                                                                      <!-- Red Button -->
                                                                      <table width="100%" border="0" cellspacing="0" cellpadding="0" bgcolor="#ef5751">
                                                                          
                                                                      </table>
                                                                      <!-- END Red Button -->
                                                                  </td>
                                                              </tr>
                                                          </table>
                                                      </td>
                                                  </tr>
                                              </table>
                                              <!-- End Top Bar -->
                                  
                                              <!-- Header Inner -->
                                              <table width="100%" border="0" cellspacing="0" cellpadding="0">
                                                  <tr>
                                                      <td>
                                                          <!-- Header Inner Red Line -->
                                                          <table width="100%" border="0" cellspacing="0" cellpadding="0" bgcolor="#4a4a44">
                                                              <tr>
                                                                  <td class="img" style="font-size:0pt; line-height:0pt; text-align:left" width="5" valign="top">
                                                                      <img src="https://ricengrills.com.au/public/mail_images/section_red_corner_tl.jpg" border="0" width="5" height="9" alt="" />
                                                                  </td>
                                                                  <td valign="top">
                                                                      <div style="font-size:0pt; line-height:0pt; height:4px; background:#ef5751; "><img src="https://ricengrills.com.au/public/mail_images/spacer.gif" width="1" height="4" style="height:4px" alt="" /></div>
      
                                                                  </td>
                                                                  <td class="img-right" style="font-size:0pt; line-height:0pt; text-align:right" width="5" valign="top">
                                                                      <img src="https://ricengrills.com.au/public/mail_images/section_red_corner_tr.jpg" border="0" width="5" height="9" alt="" />
                                                                  </td>
                                                              </tr>
                                                          </table>
                                                          <!-- END Header Inner Red Line -->
                                                          
                                                          <!-- Logo + Date + Links -->
                                                          <table width="100%" border="0" cellspacing="0" cellpadding="0" bgcolor="#FFFFFF">
                                                              <tr>
                                                                  <td class="content-spacing" style="font-size:0pt; line-height:0pt; text-align:left" width="30"></td>
                                                                  <td>
                                                                      <table width="100%" border="0" cellspacing="0" cellpadding="0" class="spacer" style="font-size:0pt; line-height:0pt; text-align:center; width:100%; min-width:100%"><tr><td height="16" class="spacer" style="font-size:0pt; line-height:0pt; text-align:center; width:100%; min-width:100%">&nbsp;</td></tr></table>
      
                                                                      <table width="100%" border="0" cellspacing="0" cellpadding="0">
                                                                          <tr>
                                                                              <!-- Column -->
                                                                              <th class="column" style="font-size:0pt; line-height:0pt; padding:0; margin:0; font-weight:normal; Margin:0" width="202" valign="top">
                                                                                  <table width="100%" border="0" cellspacing="0" cellpadding="0">
                                                                                      <tr>
                                                                                          <td class="img" style="font-size:0pt; line-height:0pt; text-align:left">
                                                                                              <!-- Logo -->
                                                                                              <div class="img-m-center" style="font-size:0pt; line-height:0pt; text-align:left"><a href="#" target="_blank"><img src="https://ricengrills.com.au/public/mail_images/logo.jpg" border="0" width="202" height="27" alt="" /></a></div>
                                                                                              <!-- END Logo -->
                                                                                              <div style="font-size:0pt; line-height:0pt;" class="mobile-br-20"></div>
      
                                                                                          </td>
                                                                                      </tr>
                                                                                  </table>
                                                                              </th>
                                                                              <!-- END Column -->
                                  
                                                                              <!-- Column -->
                                                                              <th class="column" style="font-size:0pt; line-height:0pt; padding:0; margin:0; font-weight:normal; Margin:0" valign="top">
                                                                                  <table width="100%" border="0" cellspacing="0" cellpadding="0">
                                                                                      <tr>
                                                                                          <td align="right">
                                                                                              <!-- Date + Links -->
                                                                                              <table class="center" border="0" cellspacing="0" cellpadding="0">
                                      
                                                                                              </table>
                                                                                              <!-- END Date + Links -->
                                                                                          </td>
                                                                                      </tr>
                                                                                  </table>
                                                                              </th>
                                                                              <!-- END Column -->
                                                                          </tr>
                                                                      </table>
                                                                      <table width="100%" border="0" cellspacing="0" cellpadding="0" class="spacer" style="font-size:0pt; line-height:0pt; text-align:center; width:100%; min-width:100%"><tr><td height="20" class="spacer" style="font-size:0pt; line-height:0pt; text-align:center; width:100%; min-width:100%">&nbsp;</td></tr></table>
      
                                                                  </td>
                                                                  <td class="content-spacing" style="font-size:0pt; line-height:0pt; text-align:left" width="30"></td>
                                                              </tr>
                                                          </table>
                                                      </td>
                                                  </tr>
                                              </table>
                                              <!-- END Header Inner -->
                                          </td>
                                      </tr>
                                  </table>
                                  <!-- END Header -->
      
                                  <!-- Main -->
                                  <table width="100%" border="0" cellspacing="0" cellpadding="0" bgcolor="#ffffff">
                                      <tr>
                                          <td>
                                              <!-- Section 1 -->
                                              <div class="fluid-img" style="font-size:0pt; line-height:0pt; text-align:left"><a href="#" target="_blank"><img src="https://ricengrills.com.au/public/mail_images/full_width_image.jpg" border="0" width="650" height="280" alt="" /></a></div>
                                              <!-- END Section 1 -->
      
                                              <!-- Section 2 -->
                                              <table width="100%" border="0" cellspacing="0" cellpadding="0" bgcolor="#ef5751">
                                                  <tr>
                                                      <td class="content-spacing" style="font-size:0pt; line-height:0pt; text-align:left" width="30"></td>
                                                      <td>
                                                          <table width="100%" border="0" cellspacing="0" cellpadding="0" class="spacer" style="font-size:0pt; line-height:0pt; text-align:center; width:100%; min-width:100%"><tr><td height="30" class="spacer" style="font-size:0pt; line-height:0pt; text-align:center; width:100%; min-width:100%">&nbsp;</td></tr></table>
      
                                                          <div class="h2-white-center" style="color:#ffffff; font-family:Arial,sans-serif, 'SSP'; font-size:30px; line-height:38px; text-align:center">
                                                              RiceNGrills Fresh & Tasty
                                                          </div>
                                                          <table width="100%" border="0" cellspacing="0" cellpadding="0" class="spacer" style="font-size:0pt; line-height:0pt; text-align:center; width:100%; min-width:100%"><tr><td height="8" class="spacer" style="font-size:0pt; line-height:0pt; text-align:center; width:100%; min-width:100%">&nbsp;</td></tr></table>
      
                                                          <div class="text-white-center" style="color:#ffffff; font-family:Arial,sans-serif, 'SSP'; font-size:14px; line-height:24px; text-align:center">
                                                              Dear ${name}, <br>
                                                              <p>You are receiving this email because you have requested for a passowrd reset.Please find the pass word reset link below</p>
                                                          </div>
                                                          <br/>
                                                          <br/>
                                                          <div style="padding: 15px">
                                                          <table class="ebtn" align="center" border="0" cellspacing="0" cellpadding="0" style="box-sizing: border-box;border-spacing: 0;mso-table-lspace: 0pt;mso-table-rspace: 0pt;display: table;margin-left: auto;margin-right: auto;">
                                                                  <tbody>
                                                                      <tr>
                                                                          <td class="active_b" style="box-sizing: border-box;vertical-align: top;background-color: #ff2d26;line-height: 20px;font-family: Helvetica, Arial, sans-serif;mso-line-height-rule: exactly;border-radius: 4px;text-align: center;font-weight: bold;font-size: 17px;padding: 13px 22px;"><a href='${reset_link}' style="text-decoration: none;line-height: inherit;color: #ef5751;"><span style="text-decoration: none;line-height: inherit;color: #ffffff;">Reset Link</span></a></td>
                                                                      </tr>
                                                                  </tbody>
                                                              </table>
                                                          <table width="100%" border="0" cellspacing="0" cellpadding="0" class="spacer" style="font-size:0pt; line-height:0pt; text-align:center; width:100%; min-width:100%"><tr><td height="15" class="spacer" style="font-size:0pt; line-height:0pt; text-align:center; width:100%; min-width:100%">&nbsp;</td></tr></table>

                                                          </div>
                                                                
                                                          
                                                          <!-- Call To Action -->
                                                          <table width="100%" border="0" cellspacing="0" cellpadding="0">
                                                              <tr>
                                                                  <td align="center">
                                                                      <table border="0" cellspacing="0" cellpadding="0">
                                                                          <tr>
                                                                              <td>
                                                                                  
                                                                              </td>
                                                                              <td class="img" style="font-size:0pt; line-height:0pt; text-align:left" width="10"></td>
                                                                              <td>
                                                                                  <!-- Button Transparent -->
                                                                                  <!-- END Button Transparent -->
                                                                              </td>
                                                                          </tr>
                                                                      </table>
                                                                  </td>
                                                              </tr>
                                                          </table>
                                                          <!-- END Call To Action -->
                                                          <table width="100%" border="0" cellspacing="0" cellpadding="0" class="spacer" style="font-size:0pt; line-height:0pt; text-align:center; width:100%; min-width:100%"><tr><td height="30" class="spacer" style="font-size:0pt; line-height:0pt; text-align:center; width:100%; min-width:100%">&nbsp;</td></tr></table>
      
                                                      </td>
                                                      <td class="content-spacing" style="font-size:0pt; line-height:0pt; text-align:left" width="30"></td>
                                                  </tr>
                                              </table>
                                              <!-- END Section 2 -->
      
                                              <!-- Section 3 -->
                                              <table width="100%" border="0" cellspacing="0" cellpadding="0" bgcolor="#ffffff">
                                                  <tr>
                                                      <td class="content-spacing" style="font-size:0pt; line-height:0pt; text-align:left" width="30"></td>
                                                      <td>
                                                          <table width="100%" border="0" cellspacing="0" cellpadding="0" class="spacer" style="font-size:0pt; line-height:0pt; text-align:center; width:100%; min-width:100%"><tr><td height="50" class="spacer" style="font-size:0pt; line-height:0pt; text-align:center; width:100%; min-width:100%">&nbsp;</td></tr></table>
      
                                              
                                                          <!-- Article Image On The Right -->
                                                          <table width="100%" border="0" cellspacing="0" cellpadding="0" dir="rtl" bgcolor="#ffffff" style="direction:rtl !important;">
                                                              <tr>
                                                                  <!-- Column -->
                                                                  <th class="column" style="font-size:0pt; line-height:0pt; padding:0; margin:0; font-weight:normal; Margin:0" width="260" valign="top" dir="ltr">
                                                                      <table width="100%" border="0" cellspacing="0" cellpadding="0" bgcolor="#e9e8e2" style="direction:ltr !important;">
                                                                          <tr>
                                                                              <td class="img" style="font-size:0pt; line-height:0pt; text-align:left" width="10"></td>
                                                                              <td>
                                                                                  <table width="100%" border="0" cellspacing="0" cellpadding="0" class="spacer" style="font-size:0pt; line-height:0pt; text-align:center; width:100%; min-width:100%"><tr><td height="10" class="spacer" style="font-size:0pt; line-height:0pt; text-align:center; width:100%; min-width:100%">&nbsp;</td></tr></table>
      
                                                                                  <!-- Article Image -->
                                                                                  <div class="fluid-img" style="font-size:0pt; line-height:0pt; text-align:left"><a href="https://g.page/RiceNGrills/review?gm" target="_blank"><img src="https://ricengrills.com.au/public/mail_images/article_image.jpg" border="0" width="240" height="150" alt="" /></a></div>
                                                                                  <!-- END Article Image -->
                                                                                  <table width="100%" border="0" cellspacing="0" cellpadding="0" class="spacer" style="font-size:0pt; line-height:0pt; text-align:center; width:100%; min-width:100%"><tr><td height="10" class="spacer" style="font-size:0pt; line-height:0pt; text-align:center; width:100%; min-width:100%">&nbsp;</td></tr></table>
      
                                                                              </td>
                                                                              <td class="img" style="font-size:0pt; line-height:0pt; text-align:left" width="10"></td>
                                                                          </tr>
                                                                      </table>
                                                                  </th>
                                                                  <!-- END Column -->
                                                                  <!-- Column -->
                                                                  <th class="column" style="font-size:0pt; line-height:0pt; padding:0; margin:0; font-weight:normal; Margin:0" width="34" valign="top" dir="ltr" >
                                                                      <table width="100%" border="0" cellspacing="0" cellpadding="0" style="direction:ltr !important;">
                                                                          <tr>
                                                                              <td>
                                                                                  <div style="font-size:0pt; line-height:0pt;" class="mobile-br-25"></div>
      
                                                                              </td>
                                                                          </tr>
                                                                      </table>
                                                                  </th>
                                                                  <!-- END Column -->
                                                                  <!-- Column -->
                                                                  <th class="column" style="font-size:0pt; line-height:0pt; padding:0; margin:0; font-weight:normal; Margin:0" valign="top" dir="ltr">
                                                                      <table width="100%" border="0" cellspacing="0" cellpadding="0" style="direction:ltr !important;">
                                                                          <tr>
                                                                              <td>
                                                                                  <!-- Article Content -->
                                                                                  <div class="h4" style="color:#4a4a44; font-family:Arial,sans-serif, 'SSP'; font-size:18px; line-height:24px; text-align:left">Review Us on Google</div>
                                                                                  <table width="100%" border="0" cellspacing="0" cellpadding="0" class="spacer" style="font-size:0pt; line-height:0pt; text-align:center; width:100%; min-width:100%"><tr><td height="15" class="spacer" style="font-size:0pt; line-height:0pt; text-align:center; width:100%; min-width:100%">&nbsp;</td></tr></table>
      
                                              
                                                                                  <div class="text" style="color:#949490; font-family:Arial,sans-serif, 'SSP'; font-size:14px; line-height:24px; text-align:left">
                                                                                      Your valuable feedbacks helps us in getting much better in serving you as a valuable customer. we really appreciate for your feedbacks.
                                                                                  </div>
                                              
                                                                                  <table width="100%" border="0" cellspacing="0" cellpadding="0" class="spacer" style="font-size:0pt; line-height:0pt; text-align:center; width:100%; min-width:100%"><tr><td height="16" class="spacer" style="font-size:0pt; line-height:0pt; text-align:center; width:100%; min-width:100%">&nbsp;</td></tr></table>
      
                                              
                                                                                  <!-- Button -->
                                                                                  <table width="100%" border="0" cellspacing="0" cellpadding="0">
                                                                                      <tr>
                                                                                          <td align="left"> 
                                                                                              <table border="0" cellspacing="0" cellpadding="0" bgcolor="#4a4a44" style="border-radius: 4px;">
                                                                                                  <tr>
                                                                                                      <td class="content-spacing" style="font-size:0pt; line-height:0pt; text-align:left" width="10" height="35"></td>
                                                                                                      <td>
                                                                                                          <table width="100%" border="0" cellspacing="0" cellpadding="0" class="spacer" style="font-size:0pt; line-height:0pt; text-align:center; width:100%; min-width:100%"><tr><td height="5" class="spacer" style="font-size:0pt; line-height:0pt; text-align:center; width:100%; min-width:100%">&nbsp;</td></tr></table>
      
                                                                                                          <div class="text-button1" style="color:#ffffff; font-family:Arial,sans-serif, 'SSP'; font-size:12px; line-height:16px; text-align:center; text-transform:uppercase">
                                                                                                              <a href="https://search.google.com/local/writereview?placeid=ChIJTQsYGHIT1moRBmX9hB83org" target="_blank" class="link-white" style="color:#ffffff; text-decoration:none"><span class="link-white" style="color:#ffffff; text-decoration:none">Review Us</span></a>
                                                                                                          </div>
                                                                                                          <table width="100%" border="0" cellspacing="0" cellpadding="0" class="spacer" style="font-size:0pt; line-height:0pt; text-align:center; width:100%; min-width:100%"><tr><td height="5" class="spacer" style="font-size:0pt; line-height:0pt; text-align:center; width:100%; min-width:100%">&nbsp;</td></tr></table>
      
                                                                                                      </td>
                                                                                                      <td class="content-spacing" style="font-size:0pt; line-height:0pt; text-align:left" width="10"></td>
                                                                                                  </tr>
                                                                                              </table>
                                                                                          </td>
                                                                                      </tr>
                                                                                  </table>
                                                                                  <!-- END Button -->
                                              
                                                                                  <!-- END Article Content -->
                                                                              </td>
                                                                          </tr>
                                                                      </table>
                                                                  </th>
                                                                  <!-- END Column -->
                                                              </tr>
                                                          </table>
      
                                                          <!-- END Article Image On The Right -->
                                              
                                      
                                              
                                                          <!-- Article Image On The Left -->
                                                          <table width="100%" border="0" cellspacing="0" cellpadding="0" class="spacer" style="font-size:0pt; line-height:0pt; text-align:center; width:100%; min-width:100%"><tr><td height="40" class="spacer" style="font-size:0pt; line-height:0pt; text-align:center; width:100%; min-width:100%">&nbsp;</td></tr></table>
      
                                                          <table width="100%" border="0" cellspacing="0" cellpadding="0" bgcolor="#ffffff">
                                                              <tr>
                                                                  <td>
                                                                      <table width="100%" border="0" cellspacing="0" cellpadding="0">
                                                                          <tr>
                                                                              <!-- Column -->
                                                                              <th class="column" style="font-size:0pt; line-height:0pt; padding:0; margin:0; font-weight:normal; Margin:0" width="260" valign="top">
                                                                                  <table width="100%" border="0" cellspacing="0" cellpadding="0" bgcolor="#e9e8e2">
                                                                                      <tr>
                                                                                          <td class="img" style="font-size:0pt; line-height:0pt; text-align:left" width="10"></td>
                              
                                                                                          <td class="img" style="font-size:0pt; line-height:0pt; text-align:left" width="10"></td>
                                                                                      </tr>
                                                                                  </table>
                                                                              </th>
                                                                              <!-- END Column -->
                                                                              <!-- Column -->
                                                                              <th class="column" style="font-size:0pt; line-height:0pt; padding:0; margin:0; font-weight:normal; Margin:0" width="34" valign="top">
                                                                                  <table width="100%" border="0" cellspacing="0" cellpadding="0">
                                                                                      <tr>
                                                                                          <td>
                                                                                              <div style="font-size:0pt; line-height:0pt;" class="mobile-br-25"></div>
      
                                                                                          </td>
                                                                                      </tr>
                                                                                  </table>
                                                                              </th>
                                                                              <!-- END Column -->
                                                                              <!-- Column -->
                                                                              <th class="column" style="font-size:0pt; line-height:0pt; padding:0; margin:0; font-weight:normal; Margin:0" valign="top">
                                                                                  <table width="100%" border="0" cellspacing="0" cellpadding="0">
          
                                                                                  </table>
                                                                              </th>
                                                                              <!-- END Column -->
                                                                          </tr>
                                                                      </table>
                                                                  </td>
                                                              </tr>
                                                          </table>
                                                          <!-- END Article Image On The Left -->
                                                          <table width="100%" border="0" cellspacing="0" cellpadding="0" class="spacer" style="font-size:0pt; line-height:0pt; text-align:center; width:100%; min-width:100%"><tr><td height="50" class="spacer" style="font-size:0pt; line-height:0pt; text-align:center; width:100%; min-width:100%">&nbsp;</td></tr></table>
      
                                                      </td>
                                                      <td class="content-spacing" style="font-size:0pt; line-height:0pt; text-align:left" width="30"></td>
                                                  </tr>
                                              </table>
                                              <!-- END Section 3 -->
      
                                              <!-- Section 4 -->
                                              <table width="100%" border="0" cellspacing="0" cellpadding="0">
                                                  <tr>
                                                      
                                                          <!--[if gte mso 9]>
                                                          <v:rect xmlns:v="urn:schemas-microsoft-com:vml" fill="true" stroke="false" style="width:650px; height: 240px">
                                                              <v:fill type="frame" src="https://ricengrills.com.au/public/mail_images/bg1.jpg" color="#44453f" />
                                                              <v:textbox inset="0,0,0,0">
                                                          <![endif]-->
                                                          <div>
                                                              <table width="100%" border="0" cellspacing="0" cellpadding="0">
                                      
                                                              </table>
                                                          </div>
                                                          
                                                      </td>
                                                  </tr>
                                              </table>
                                              <!-- END Section 4 -->
      
                                              <!-- Section 5 -->
                                              
                                                                  <!-- Column -->
                                                                  <th class="column" style="font-size:0pt; line-height:0pt; padding:0; margin:0; font-weight:normal; Margin:0" width="20">
                                                                      <table width="100%" border="0" cellspacing="0" cellpadding="0">
                                                                          <tr>
                                                                              <td>
                                                                                  <div style="font-size:0pt; line-height:0pt;" class="mobile-br-25"></div>
      
                                                                              </td>
                                                                          </tr>
                                                                      </table>
                                                                  </th>
                                                                  <!-- END Column -->
                                                                  <!-- Column -->
                                                                  <th class="column" style="font-size:0pt; line-height:0pt; padding:0; margin:0; font-weight:normal; Margin:0" valign="top">
                                                                      <table width="100%" border="0" cellspacing="0" cellpadding="0">
                                                                          <tr>
                                                                              <td>
                                                                                  <!-- Image -->
                                                                                  <table width="100%" border="0" cellspacing="0" cellpadding="0" bgcolor="#e9e8e2">
                                                                                      <tr>
                                                                                          <td class="img" style="font-size:0pt; line-height:0pt; text-align:left" width="10"></td>
                                                                                          <td>
                                                                                              <table width="100%" border="0" cellspacing="0" cellpadding="0" class="spacer" style="font-size:0pt; line-height:0pt; text-align:center; width:100%; min-width:100%"><tr><td height="10" class="spacer" style="font-size:0pt; line-height:0pt; text-align:center; width:100%; min-width:100%">&nbsp;</td></tr></table>
      
                                                                                              
                                                                                              <table width="100%" border="0" cellspacing="0" cellpadding="0" class="spacer" style="font-size:0pt; line-height:0pt; text-align:center; width:100%; min-width:100%"><tr><td height="10" class="spacer" style="font-size:0pt; line-height:0pt; text-align:center; width:100%; min-width:100%">&nbsp;</td></tr></table>
      
                                                                                          </td>
                                                                                          <td class="img" style="font-size:0pt; line-height:0pt; text-align:left" width="10"></td>
                                                                                      </tr>
                                                                                  </table>
                                                                                  <table width="100%" border="0" cellspacing="0" cellpadding="0" class="spacer" style="font-size:0pt; line-height:0pt; text-align:center; width:100%; min-width:100%"><tr><td height="14" class="spacer" style="font-size:0pt; line-height:0pt; text-align:center; width:100%; min-width:100%">&nbsp;</td></tr></table>
      
                                                                                  <!-- END Image -->
                                              
                                                                                  
                                                                              </td>
                                                                          </tr>
                                                                      </table>
                                                                  </th>
                                                                  <!-- END Column -->
                                                              </tr>
                                                          </table>
                                                          <div class="hide-for-mobile">
                                                              <table width="100%" border="0" cellspacing="0" cellpadding="0" class="spacer" style="font-size:0pt; line-height:0pt; text-align:center; width:100%; min-width:100%"><tr><td height="12" class="spacer" style="font-size:0pt; line-height:0pt; text-align:center; width:100%; min-width:100%">&nbsp;</td></tr></table>
      
                                                          </div>
                                                          <table width="100%" border="0" cellspacing="0" cellpadding="0" class="spacer" style="font-size:0pt; line-height:0pt; text-align:center; width:100%; min-width:100%"><tr><td height="30" class="spacer" style="font-size:0pt; line-height:0pt; text-align:center; width:100%; min-width:100%">&nbsp;</td></tr></table>
      
                                                      </td>
                                                      <td class="content-spacing" style="font-size:0pt; line-height:0pt; text-align:left" width="30"></td>
                                                  </tr>
                                              </table>
                                              <!-- END Section 5 -->
      
                                              
           
                                  
                                  <!-- Footer -->
                                  <table width="100%" border="0" cellspacing="0" cellpadding="0" bgcolor="#363731">
                                      <tr>
                                          <td>
                                              <!-- Footer Inner -->
                                              <table width="100%" border="0" cellspacing="0" cellpadding="0">
                                                  <tr>
                                                      <td class="content-spacing" style="font-size:0pt; line-height:0pt; text-align:left" width="30"></td>
                                                      <td>
                                                          <table width="100%" border="0" cellspacing="0" cellpadding="0" class="spacer" style="font-size:0pt; line-height:0pt; text-align:center; width:100%; min-width:100%"><tr><td height="30" class="spacer" style="font-size:0pt; line-height:0pt; text-align:center; width:100%; min-width:100%">&nbsp;</td></tr></table>
      
                                                          <table width="100%" border="0" cellspacing="0" cellpadding="0">
                                                              <tr>
                                                                  <!-- Column -->
                                                                  <th class="column" style="font-size:0pt; line-height:0pt; padding:0; margin:0; font-weight:normal; Margin:0" width="276" valign="top">
                                                                      <table width="100%" border="0" cellspacing="0" cellpadding="0">
                                                                          <tr>
                                                                              <td class="img" style="font-size:0pt; line-height:0pt; text-align:left">
                                                                                  <!-- Footer Logo -->
                                                                                  <div class="img-m-center" style="font-size:0pt; line-height:0pt; text-align:left"><a href="#" target="_blank"><img src="https://ricengrills.com.au/public/mail_images/free_footer_logo.png" border="0" width="320" height="50" alt="" /></a></div>
                                                                                  <!-- END Footer Logo -->
                                                                                  <table width="100%" border="0" cellspacing="0" cellpadding="0" class="spacer" style="font-size:0pt; line-height:0pt; text-align:center; width:100%; min-width:100%"><tr><td height="20" class="spacer" style="font-size:0pt; line-height:0pt; text-align:center; width:100%; min-width:100%">&nbsp;</td></tr></table>
      
                                                                              </td>
                                                                          </tr>
                                                                      </table>
                                                                  </th>
                                                                  <!-- END Column -->
                                                                  <!-- Column -->
      
      
                                                                  <th class="column" style="font-size:0pt; line-height:0pt; padding:0; margin:0; font-weight:normal; Margin:0" valign="top">
                                                                      <table width="100%" border="0" cellspacing="0" cellpadding="0">
                                                                          <tr>
                                                                              <td>
                                                                                  <!-- Socials -->
                                                                                  <table width="100%" border="0" cellspacing="0" cellpadding="0">
                                                                                      <tr>
                                                                                          <td align="right">
                                                                                              <table border="0" cellspacing="0" cellpadding="0" class="center">
                                                                                                  <tr>
                                                                                                      <td class="img" style="font-size:0pt; line-height:0pt; text-align:left" width="28"><a href="https://www.facebook.com/RiceNGrillsOfficial" target="_blank"><img src="https://ricengrills.com.au/public/mail_images/ico3_facebook.jpg" border="0" width="18" height="21" alt="" /></a></td>
                                                                                                      <td class="img" style="font-size:0pt; line-height:0pt; text-align:left" width="28"><a href="#" target="_blank"><img src="https://ricengrills.com.au/public/mail_images/ico3_twitter.jpg" border="0" width="18" height="21" alt="" /></a></td>
                                                                                                      <td class="img" style="font-size:0pt; line-height:0pt; text-align:left" width="28"><a href="#" target="_blank"><img src="https://ricengrills.com.au/public/mail_images/ico3_gplus.jpg" border="0" width="18" height="21" alt="" /></a></td>
                              
                                                                                                  </tr>
                                                                                              </table>
                                                                                          </td>
                                                                                      </tr>
                                                                                  </table>
                                                                                  <table width="100%" border="0" cellspacing="0" cellpadding="0" class="spacer" style="font-size:0pt; line-height:0pt; text-align:center; width:100%; min-width:100%"><tr><td height="20" class="spacer" style="font-size:0pt; line-height:0pt; text-align:center; width:100%; min-width:100%">&nbsp;</td></tr></table>
      
                                                                                  <!-- END Socials -->
                                                                              </td>
                                                                          </tr>
                                                                      </table>
                                                                  </th>
                                                                  <!-- END Column -->
                                                              </tr>
                                                          </table>
                                                          <table width="100%" border="0" cellspacing="0" cellpadding="0">
                                                              <tr>
                                                                  <!-- Column -->
                                                                  <th class="column" style="font-size:0pt; line-height:0pt; padding:0; margin:0; font-weight:normal; Margin:0" width="276" valign="top">
                                                                      <table width="100%" border="0" cellspacing="0" cellpadding="0">
                                                                          <tr>
                                                                              <td>
                                                                  
                                                                                  <table width="100%" border="0" cellspacing="0" cellpadding="0" class="spacer" style="font-size:0pt; line-height:0pt; text-align:center; width:100%; min-width:100%"><tr><td height="10" class="spacer" style="font-size:0pt; line-height:0pt; text-align:center; width:100%; min-width:100%">&nbsp;</td></tr></table>
      
                                                                              </td>
                                                                          </tr>
                                                                      </table>
                                                                  </th>
                                                                  <!-- END Column -->
                                                                  
                                                              </tr>
                                                          </table>
                                                          <table width="100%" border="0" cellspacing="0" cellpadding="0" class="spacer" style="font-size:0pt; line-height:0pt; text-align:center; width:100%; min-width:100%"><tr><td height="30" class="spacer" style="font-size:0pt; line-height:0pt; text-align:center; width:100%; min-width:100%">&nbsp;</td></tr></table>
      
                                  
                                                      </td>
                                                      <td class="content-spacing" style="font-size:0pt; line-height:0pt; text-align:left" width="30"></td>
                                                  </tr>
                                              </table>
                                              <!-- END Footer Inner -->
                                              <table width="100%" border="0" cellspacing="0" cellpadding="0" bgcolor="#3f4039">
                                                  
                                              </table>
                                          </td>
                                      </tr>
                                  </table>
                                  <div class="hide-for-mobile"><table width="100%" border="0" cellspacing="0" cellpadding="0" class="spacer" style="font-size:0pt; line-height:0pt; text-align:center; width:100%; min-width:100%"><tr><td height="30" class="spacer" style="font-size:0pt; line-height:0pt; text-align:center; width:100%; min-width:100%">&nbsp;</td></tr></table>
      </div>
                                  <!-- END Footer -->
                              </td>
                          </tr>
                      </table>
                  </td>	
              </tr>
          </table>
      </body>
      </html>`
    };
    await sgMail.send(msg);
  } catch (err) {
    console.log(err);
  }
};