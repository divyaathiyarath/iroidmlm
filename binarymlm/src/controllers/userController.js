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
                                if(doc.rc!=null){
                                    mp = doc.matchingPoint + 50
                                    // matching(doc.userCode)
                                    if(doc.parent){
                                        isSymmetric(doc.parent,doc.userCode)
                                    }
                                }
                                user.findOneAndUpdate({userCode:doc.userCode},{lc:userCode,matchingPoint:mp},(error,response)=>{
                                    if(error){
                                        throw error
                                    }
                                })
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
                                _user.level = doc.level + 1
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
                                if(doc.lc!=null){
                                    mp = doc.matchingPoint + 50
                                    // matching(doc.userCode)
                                    if(doc.parent){
                                        isSymmetric(doc.parent,doc.userCode)
                                    }
                                }
                                user.findOneAndUpdate({userCode:doc.userCode},{rc:userCode,matchingPoint:mp},(error,response)=>{
                                    if(error){
                                        throw error
                                    }
                                })
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
                                _user.level = doc.level + 1
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
               let isSymmetric = async (pa,user)=>{
                   let parent = await user.findOne({userCode:pa})
                   let children = async(left,right)=>{
                       let leftUser = user.find({userCode:left})
                       let rightUser = user.find({userCode:right})
                       if(leftUser.lc && leftUser.rc && rightUser.lc && rightUser.rc){
                           children(leftUser.lc,leftUser.rc)
                           children(rightUser.lc,rightUser.rc)
                       }
                       else if(!leftUser.lc && !leftUser.rc && !rightUser.lc && !rightUser.rc){
                            if(leftUser.left == _user.level){
                                mp = parent.matchingPoint + 50
                                user.findOneAndUpdate({userCode:parent.userCode},{matchingPoint:mp})
                                if(parent.parent){
                                    isSymmetric(parent.parent,parent.userCode)
                                }
                            }
                       }
                   }
                   if(parent.rc){
                    if(parent.rc != _user){
                        let rightChild = user.findOne({userCode:parent.rc})
                        children(rightChild.lc,rightChild.rc)
                    }
                   }else if(parent.lc){
                    if(parent.lc != _user){
                        let leftChild = user.findOne({userCode:parent.lc})
                        children(leftChild.lc,leftChild.rc)
                    }
                   }

               }
           }
           res.send("Success")
       })
    }
    catch(error){
        console.log(error)
    }
}
