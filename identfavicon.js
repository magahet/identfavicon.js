(function(global) {
    if (global["favicon"]) {
        return;
    }

    /*\
    |*| Private
    \*/

    var head = global.document.getElementsByTagName("head")[0];
    var sequencePause;
    var iconSequence;
    var iconIndex;
    var loopTimeout = null;
    var preloadIcons = function(icons) {
        var image = new Image();
        for (var i = 0; i < icons.length; i++) {
            image.src = icons[i];
        }
    };
    var addLink = function(iconUrl) {
        var newLink = document.createElement("link");
        newLink.type = "image/x-icon";
        newLink.rel = "icon";
        newLink.href = iconUrl;
        removeLinkIfExists();
        head.appendChild(newLink);
    };
    var removeLinkIfExists = function() {
        var links = head.getElementsByTagName("link");
        var l = links.length;
        for (; --l >= 0; /\bicon\b/i.test(links[l].getAttribute("rel")) && head.removeChild(links[l])) {}
    };

    /*
      Client-side Canvas tag based Identicon rendering code

      @author  Don Park (adapted by David Hanak)
      @version 0.2
      @date    January 21th, 2007
    */
    var mRenderer = {
        patches: new Array(
                           new Array( 0, 4, 24, 20 ),
                           new Array( 0, 4, 20 ),
                           new Array( 2, 24, 20 ),
                           new Array( 0, 2,  20, 22 ),
                           new Array( 2, 14, 22, 10 ),
                           new Array( 0, 14, 24, 22 ),
                           new Array( 2, 24, 22, 13, 11, 22, 20 ),
                           new Array( 0, 14, 22 ),
                           new Array( 6, 8, 18, 16 ),
                           new Array( 4, 20, 10, 12, 2 ),
                           new Array( 0, 2, 12, 10 ),
                           new Array( 10, 14, 22 ),
                           new Array( 20, 12, 24 ),
                           new Array( 10, 2, 12 ),
                           new Array( 0, 2, 10 ),
			   new Array( 7, 13, 17, 11 ) // small diamond in middle
                           ),
        centerPatches: new Array(0, 4, 8, 15),

        renderPatch: function (ctx, x, y, size, patch, turn, invert, color) {
            //if (patch == 15) invert = !invert;
            patch %= this.patches.length;
            turn %= 4;

            var vertices = this.patches[patch];
            var offset = size / 2;
            var scale = size / 4;

            ctx.save();
            ctx.beginPath();

            // draw reverse background path if inversion is required
            if (invert) {
                ctx.moveTo(x, y);
                ctx.lineTo(x, y + size);
                ctx.lineTo(x + size, y + size);
                ctx.lineTo(x + size, y);
                ctx.closePath();
            }

            // offset and rotate coordinate space by patch position (x, y) and
            // 'turn' before rendering patch shape
            ctx.translate(x + offset, y + offset);
            ctx.rotate(turn * Math.PI / 2);

            // build patch path
            ctx.moveTo((vertices[0] % 5 * scale - offset),
                       (Math.floor(vertices[0] / 5) * scale - offset));
            for (var i = 1; i < vertices.length; i++) {
                ctx.lineTo((vertices[i] % 5 * scale - offset),
                           (Math.floor(vertices[i] / 5) * scale - offset));
            }
            ctx.closePath();

            // render rotated patch using color (or its inverse)
            ctx.fillStyle = color;
            ctx.fill();

            // restore rotation
            ctx.restore();
        },

        render: function (node, code, size) {
            if (!node || !code || !size) return;

            var patchSize = size / 3;
            var middleType = this.centerPatches[code & 3];
            var middleInvert = ((code >> 2) & 1) != 0;
            var cornerType = (code >> 3) & 15;
            var cornerInvert = ((code >> 7) & 1) != 0;
            var cornerTurn = (code >> 8) & 3;
            var sideType = (code >> 10) & 15;
            var sideInvert = ((code >> 14) & 1) != 0;
            var sideTurn = (code >> 15) & 3;
            var blue = (code >> 16) & 31;
            var green = (code >> 21) & 31;
            var red = (code >> 27) & 31;
            var color = "rgb(" + (red << 3) + "," + (green << 3) + "," + (blue << 3) + ")";

	    // avoid accidental swastikas
	    if ((middleType == 0 && cornerType == 0 && sideType == 10 &&
		 middleInvert != cornerInvert && cornerInvert == sideInvert) ||
		// http://www.aplumbers.com/contact-us.php
		(middleType == 0 && cornerType == 10 && sideType == 10 &&
		 middleInvert == cornerInvert && cornerInvert != sideInvert)) {
		this.render(node, (1<<31)-code, size);
		return;
	    }

            var ctx = node.getContext("2d");

            // middle patch
            this.renderPatch(ctx, patchSize, patchSize, patchSize, middleType, 0, middleInvert, color);
            // side patches, starting from top and moving clock-wise
            this.renderPatch(ctx, patchSize, 0, patchSize, sideType, sideTurn++, sideInvert, color);
            this.renderPatch(ctx, patchSize * 2, patchSize, patchSize, sideType, sideTurn++, sideInvert, color);
            this.renderPatch(ctx, patchSize, patchSize * 2, patchSize, sideType, sideTurn++, sideInvert, color);
            this.renderPatch(ctx, 0, patchSize, patchSize, sideType, sideTurn++, sideInvert, color);
            // corner patches, starting from top left and moving clock-wise
            this.renderPatch(ctx, 0, 0, patchSize, cornerType, cornerTurn++, cornerInvert, color);
            this.renderPatch(ctx, patchSize * 2, 0, patchSize, cornerType, cornerTurn++, cornerInvert, color);
            this.renderPatch(ctx, patchSize * 2, patchSize * 2, patchSize, cornerType, cornerTurn++, cornerInvert, color);
            this.renderPatch(ctx, 0, patchSize * 2, patchSize, cornerType, cornerTurn++, cornerInvert, color);
        }
    };

    /*
      CRC-32 code generator

      @author http://www.webtoolkit.info/ (adapted by David Hanak)
    */
    var crc32table = "00000000 77073096 EE0E612C 990951BA 076DC419 706AF48F E963A535 9E6495A3 0EDB8832 79DCB8A4 E0D5E91E 97D2D988 09B64C2B 7EB17CBD E7B82D07 90BF1D91 1DB71064 6AB020F2 F3B97148 84BE41DE 1ADAD47D 6DDDE4EB F4D4B551 83D385C7 136C9856 646BA8C0 FD62F97A 8A65C9EC 14015C4F 63066CD9 FA0F3D63 8D080DF5 3B6E20C8 4C69105E D56041E4 A2677172 3C03E4D1 4B04D447 D20D85FD A50AB56B 35B5A8FA 42B2986C DBBBC9D6 ACBCF940 32D86CE3 45DF5C75 DCD60DCF ABD13D59 26D930AC 51DE003A C8D75180 BFD06116 21B4F4B5 56B3C423 CFBA9599 B8BDA50F 2802B89E 5F058808 C60CD9B2 B10BE924 2F6F7C87 58684C11 C1611DAB B6662D3D 76DC4190 01DB7106 98D220BC EFD5102A 71B18589 06B6B51F 9FBFE4A5 E8B8D433 7807C9A2 0F00F934 9609A88E E10E9818 7F6A0DBB 086D3D2D 91646C97 E6635C01 6B6B51F4 1C6C6162 856530D8 F262004E 6C0695ED 1B01A57B 8208F4C1 F50FC457 65B0D9C6 12B7E950 8BBEB8EA FCB9887C 62DD1DDF 15DA2D49 8CD37CF3 FBD44C65 4DB26158 3AB551CE A3BC0074 D4BB30E2 4ADFA541 3DD895D7 A4D1C46D D3D6F4FB 4369E96A 346ED9FC AD678846 DA60B8D0 44042D73 33031DE5 AA0A4C5F DD0D7CC9 5005713C 270241AA BE0B1010 C90C2086 5768B525 206F85B3 B966D409 CE61E49F 5EDEF90E 29D9C998 B0D09822 C7D7A8B4 59B33D17 2EB40D81 B7BD5C3B C0BA6CAD EDB88320 9ABFB3B6 03B6E20C 74B1D29A EAD54739 9DD277AF 04DB2615 73DC1683 E3630B12 94643B84 0D6D6A3E 7A6A5AA8 E40ECF0B 9309FF9D 0A00AE27 7D079EB1 F00F9344 8708A3D2 1E01F268 6906C2FE F762575D 806567CB 196C3671 6E6B06E7 FED41B76 89D32BE0 10DA7A5A 67DD4ACC F9B9DF6F 8EBEEFF9 17B7BE43 60B08ED5 D6D6A3E8 A1D1937E 38D8C2C4 4FDFF252 D1BB67F1 A6BC5767 3FB506DD 48B2364B D80D2BDA AF0A1B4C 36034AF6 41047A60 DF60EFC3 A867DF55 316E8EEF 4669BE79 CB61B38C BC66831A 256FD2A0 5268E236 CC0C7795 BB0B4703 220216B9 5505262F C5BA3BBE B2BD0B28 2BB45A92 5CB36A04 C2D7FFA7 B5D0CF31 2CD99E8B 5BDEAE1D 9B64C2B0 EC63F226 756AA39C 026D930A 9C0906A9 EB0E363F 72076785 05005713 95BF4A82 E2B87A14 7BB12BAE 0CB61B38 92D28E9B E5D5BE0D 7CDCEFB7 0BDBDF21 86D3D2D4 F1D4E242 68DDB3F8 1FDA836E 81BE16CD F6B9265B 6FB077E1 18B74777 88085AE6 FF0F6A70 66063BCA 11010B5C 8F659EFF F862AE69 616BFFD3 166CCF45 A00AE278 D70DD2EE 4E048354 3903B3C2 A7672661 D06016F7 4969474D 3E6E77DB AED16A4A D9D65ADC 40DF0B66 37D83BF0 A9BCAE53 DEBB9EC5 47B2CF7F 30B5FFE9 BDBDF21C CABAC28A 53B39330 24B4A3A6 BAD03605 CDD70693 54DE5729 23D967BF B3667A2E C4614AB8 5D681B02 2A6F2B94 B40BBE37 C30C8EA1 5A05DF1B 2D02EF8D";
    var crc32 = function(aStr) {
        function utf8Encode(string) {
            string = string.replace(/\r\n/g,"\n");
            var utftext = "";
            for (var n = 0; n < string.length; n++) {
                var c = string.charCodeAt(n);
                if (c < 128) {
                    utftext += String.fromCharCode(c);
                }
                else if((c > 127) && (c < 2048)) {
                    utftext += String.fromCharCode((c >> 6) | 192);
                    utftext += String.fromCharCode((c & 63) | 128);
                }
                else {
                    utftext += String.fromCharCode((c >> 12) | 224);
                    utftext += String.fromCharCode(((c >> 6) & 63) | 128);
                    utftext += String.fromCharCode((c & 63) | 128);
                }
            }
            return utftext;
        };

        aStr = utf8Encode(aStr);
        var crc = 0;
        var x = 0;
        var y = 0;
        crc = crc ^ (-1);
        for( var i = 0, iTop = aStr.length; i < iTop; i++ ) {
            y = ( crc ^ aStr.charCodeAt( i ) ) & 0xFF;
            x = "0x" + crc32table.substr( y * 9, 8 );
            crc = ( crc >>> 8 ) ^ x;
        }
        return crc ^ (-1);
    };

    // From favicon.js by Mark Old

    var change = function(iconURL, optionalDocTitle) {
        clearTimeout(loopTimeout);
        if (optionalDocTitle) {
            document.title = optionalDocTitle;
        }
        if (iconURL !== "") {
            addLink(iconURL);
        }
    };

    /*\
    |*| Public
    \*/

    global["identfavicon"] = {
        'makeFaviconURL': function(aCanvas, aURI) {
            aCanvas.setAttribute('width', '16');
            aCanvas.setAttribute('height', '16');
            mRenderer.render(aCanvas, crc32(aURI), 16);
            return aCanvas.toDataURL("image/png", "");
        },
        'replace': function() {
            var canvas = document.createElement('canvas');
            var imageURL = this.makeFaviconURL(canvas, window.location.host);
            change(imageURL);
        }
    };
})(this);
