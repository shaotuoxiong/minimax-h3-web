import argparse
import ipaddress
import json
import socket
import subprocess
import time
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET

DESCRIPTION = "MiniMax H3 direct HTTPS"


class GatewayError(RuntimeError):
    pass


class Gateway:
    def __init__(self, description_url):
        self.opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
        tree = ET.fromstring(self.opener.open(description_url, timeout=5).read())
        namespace = {"d": "urn:schemas-upnp-org:device-1-0"}
        service = next(
            item for item in tree.findall(".//d:service", namespace)
            if ":WANIPConnection:" in item.findtext("d:serviceType", namespaces=namespace)
            or ":WANPPPConnection:" in item.findtext("d:serviceType", namespaces=namespace)
        )
        self.service_type = service.findtext("d:serviceType", namespaces=namespace)
        self.control_url = urllib.parse.urljoin(
            description_url, service.findtext("d:controlURL", namespaces=namespace)
        )
        if urllib.parse.urlparse(self.control_url).hostname != urllib.parse.urlparse(description_url).hostname:
            raise GatewayError("Gateway control URL does not match the discovered gateway")

    def call(self, action, **arguments):
        envelope = ET.Element("s:Envelope", {"xmlns:s": "http://schemas.xmlsoap.org/soap/envelope/"})
        body = ET.SubElement(envelope, "s:Body")
        operation = ET.SubElement(body, "u:" + action, {"xmlns:u": self.service_type})
        for key, value in arguments.items():
            ET.SubElement(operation, key).text = str(value)
        request = urllib.request.Request(
            self.control_url, data=ET.tostring(envelope),
            headers={"Content-Type": "text/xml; charset=utf-8", "SOAPAction": f'"{self.service_type}#{action}"'},
        )
        try:
            response = self.opener.open(request, timeout=5)
            data = response.read()
        except urllib.error.HTTPError as error:
            values = self.parse(error.read())
            if values.get("errorCode") == "714":
                return None
            raise GatewayError(f'Gateway action {action} failed: {values.get("errorCode")} {values.get("errorDescription")}') from error
        if action in {"AddPortMapping", "DeletePortMapping"}:
            return {}
        return self.parse(data)

    @staticmethod
    def parse(data):
        return {item.tag.split("}")[-1]: item.text or "" for item in ET.fromstring(data).iter()}

    def ensure_mapping(self, address, external_port, internal_port):
        query = {"NewRemoteHost": "", "NewExternalPort": external_port, "NewProtocol": "TCP"}
        existing = self.call("GetSpecificPortMappingEntry", **query)
        if existing and (
            existing.get("NewInternalClient") != address
            or existing.get("NewInternalPort") != str(internal_port)
            or existing.get("NewPortMappingDescription") != DESCRIPTION
        ):
            raise GatewayError("Refusing to replace an existing port mapping")
        self.call(
            "AddPortMapping", **query, NewInternalPort=internal_port,
            NewInternalClient=address, NewEnabled=1,
            NewPortMappingDescription=DESCRIPTION, NewLeaseDuration=600,
        )
        actual = self.call("GetSpecificPortMappingEntry", **query)
        if not actual or actual.get("NewInternalClient") != address or actual.get("NewInternalPort") != str(internal_port):
            raise GatewayError("Router did not preserve the requested HTTPS mapping")
        return actual


def discover_gateway():
    routes = json.loads(subprocess.check_output(["ip", "-j", "-4", "route", "show", "default"]))
    route = next(item for item in routes if "gateway" in item)
    gateway = route["gateway"]
    interfaces = json.loads(subprocess.check_output(["ip", "-j", "-4", "address", "show", "dev", route["dev"]]))
    address = next(
        item["local"] for item in interfaces[0]["addr_info"]
        if ipaddress.ip_address(gateway) in ipaddress.ip_network(f'{item["local"]}/{item["prefixlen"]}', strict=False)
    )
    with socket.socket(socket.AF_INET, socket.SOCK_DGRAM, socket.IPPROTO_UDP) as sock:
        sock.setsockopt(socket.IPPROTO_IP, socket.IP_MULTICAST_IF, socket.inet_aton(address))
        sock.settimeout(1)
        message = 'M-SEARCH * HTTP/1.1\r\nHOST: 239.255.255.250:1900\r\nMAN: "ssdp:discover"\r\nMX: 1\r\nST: urn:schemas-upnp-org:device:InternetGatewayDevice:1\r\n\r\n'
        sock.sendto(message.encode(), ("239.255.255.250", 1900))
        deadline = time.monotonic() + 5
        while time.monotonic() < deadline:
            try:
                packet, sender = sock.recvfrom(8192)
            except socket.timeout:
                continue
            if sender[0] != gateway:
                continue
            for line in packet.decode(errors="replace").splitlines():
                if line.lower().startswith("location:"):
                    url = line.split(":", 1)[1].strip()
                    if urllib.parse.urlparse(url).hostname == gateway:
                        return Gateway(url), address
    raise GatewayError("The default gateway did not answer UPnP discovery")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--external-port", type=int, default=47863)
    parser.add_argument("--internal-port", type=int, default=8443)
    args = parser.parse_args()
    gateway, address = discover_gateway()
    wan = gateway.call("GetExternalIPAddress")["NewExternalIPAddress"]
    if not ipaddress.ip_address(wan).is_global:
        raise GatewayError("Router no longer has a globally routable IPv4 address")
    if args.apply:
        gateway.ensure_mapping(address, args.external_port, args.internal_port)
    print(json.dumps({"wan_ipv4": wan, "lan_ipv4": address, "mapping_applied": args.apply}))


if __name__ == "__main__":
    main()
