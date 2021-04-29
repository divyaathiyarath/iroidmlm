const { app } = require("../server")
const user = require('../models/user')
const referralCodeGenerator = require('referral-code-generator')
exports.register = async(req,res)=>{
    try {
        //User code generation
        var userCode = referralCodeGenerator.alphaNumeric('lowercase',2,2)
        console.log("userCode  "+userCode)
        //Checking user already exist or not
       user.find({email:req.body.email},(error,data)=>{
           if(error){
               throw error
           }
           else {
               if(data.length!=0) {
                res.send('User already exist')
               }
               else {
                   // save user data
                   req.body.userCode = userCode
                   var _user = new user(req.body)
                   _user.save((error,data)=>{
                       if(error) {
                           throw error
                       }
                   })
                   //Update referncer collection
                   user.find({userCode:req.body.referenceId},(error,data)=>{
                       var mp
                       var rp
                       if(error) {
                           throw error
                       }
                       else {
                           // Updating left sub tree
                           let inOrderLeft = async (doc)=>{
                            let result = await user.findOne({userCode:doc.lc})
                            if(result){
                                inOrderLeft(result)
                            }
                            else{
                                let mp = 0
                                rp = data[0].referencePoint+100
                                // if(doc.rc!=null){
                                    mp = doc.matchingPoint + 50
                                    // matching(doc.parent)
                                    console.log("x........    "+doc)
                                    console.log("userCode of x.....  "+doc.userCode)
                                    matching(doc.userCode)
                                // }
                                // user.findOneAndUpdate({userCode:doc.userCode},{lc:userCode,matchingPoint:mp},(error,response)=>{
                                //     if(error){
                                //         throw error
                                //     }
                                // })
                                user.findOneAndUpdate({userCode:doc.userCode},{lc:userCode},(error,response)=>{
                                    if(error){
                                        throw error
                                    }
                                })
                                user.findOneAndUpdate({userCode:data[0].userCode},{referencePoint:rp},(error,response)=>{
                                    if(error){
                                        throw error
                                    }
                                })
                                _user.rootParent = data[0].userCode
                                _user.parent = doc.userCode
                                _user.save().then(
                                    console.log("updated")
                                ).catch(err=>{
                                    res.send(err)
                                })

                            }
                        }
                        //Updating right sub tree
                        let inOrderRight = async(doc)=>{
                            let result = await user.findOne({userCode:doc.rc})
                            if(result){
                                inOrderRight(result)
                            }
                            else{
                                rp = data[0].referencePoint+100
                                // if(doc.lc!=null){
                                    // mp = doc.matchingPoint + 50
                                    console.log("matching user right...........   "+doc.userCode);
                                    matching(doc.userCode)
                                // }
                                // user.findOneAndUpdate({userCode:doc.userCode},{rc:userCode,matchingPoint:mp},(error,response)=>{
                                //     if(error){
                                //         throw error
                                //     }
                                // })
                                user.findOneAndUpdate({userCode:doc.userCode},{rc:userCode},(error,response)=>{
                                    if(error){
                                        throw error
                                    }
                                })
                                user.findOneAndUpdate({userCode:data[0].userCode},{referencePoint:rp},(error,response)=>{
                                    if(error){
                                        throw error
                                    }
                                })
                                _user.rootParent = data[0].userCode
                                _user.parent = doc.userCode
                                _user.save().then(
                                    
                                    console.log("success")
                                ).catch(err=>{
                                    res.send(err)
                                })

                            }
                        }
                        console.log("Traversal........")
                        if(req.body.child== 'l') {
                            console.log("inOrderLeft call......"+data[0])
                            inOrderLeft(data[0])
                       
                        }
                        if(req.body.child== 'r') {
                            inOrderRight(data[0])
                         }
                       }
                   })

               }
               // Matching
               let matching = async (root)=>{
                let i = 0
                console.log("rootx......."+root);
                let result = await user.findOne({userCode:root})
                console.log("Parent data    "+result)
                    op = await isSymmetric(result)
                    console.log("op   "+op)
                    if(op == false || result == null){
                        console.log("False condition")
                        res.send("Completed")
                    }
                    if(op == true){
                        console.log("True condition")
                        i++
                        console.log("mp  "+i)
                        //Add matching point
                        mp = result.matchingPoint + 50
                        await user.findOneAndUpdate({userCode:root},{matchingPoint:mp})
                        if(result.parent != null){
                            matching(result.parent)
                        }
                        if(result.parent == null){
                           res.send("Completed")
                         }
                         
                        
                    }
               }
               let isSymmetric = async (root)=>{
                   console.log("isSymmetric root   "+root)
                   let le = await user.findOne({userCode:root.lc})
                   let ri = await user.findOne({userCode:root.rc})
                   if((le == null && ri != null) || (le !=null && ri == null)){
                    return false
                    }
                //    if(root.lc != null && root.rc != null){
                    return isMirror(root.lc,root.rc)
                //    }
                //    else{
                       return false
                //    }
                   
               }
               let isMirror = async (l,r)=>{
                   console.log("isMirror")
                   let le = await user.findOne({userCode:l})
                   let ri = await user.findOne({userCode:r})
                   if(le == null && ri == null){
                       console.log("checking le == null && ri == null")
                       return true
                   }
                   if(le !=null && ri!= null){
                       console.log("checking le !=null && ri!= null")
                       return (isMirror(le.lc,le.rc) && isMirror(ri.lc,ri.rc))
                   }
                   

                    //    return false
               }
               //
           }
       })
    }
    catch(error){
        console.log(error)
    }
}
