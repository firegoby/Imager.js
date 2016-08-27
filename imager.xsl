<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">

    <xsl:template name="imager">
        <xsl:param name="image"/>
        <xsl:param name="width"/>
        <xsl:param name="class" select="'imager'"/>
        <xsl:param name="alt" select="''"/>
        <xsl:param name="jit" select="'/image/1/{$width}/0'"/>
        <div class="{$class}" data-src="{$jit}{$image/@path}/{$image/filename}" data-width="{$width}" data-alt="{$alt}">
            <noscript>
                <img src="{$jit}{$image/@path}/{$image/filename}" alt="{$alt}"/>
            </noscript>
        </div>
    </xsl:template>

</xsl:stylesheet>
